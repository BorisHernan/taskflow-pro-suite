package pe.taskflow.board.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.security.oauth2.jwt.Jwt;
import pe.taskflow.board.auth.Sesiones;
import pe.taskflow.board.config.TaskEventPublisher;
import pe.taskflow.board.gestion.IncidenciaService;
import pe.taskflow.board.ventas.OrdenService;
import pe.taskflow.board.demo.ContentModerationService;
import pe.taskflow.board.demo.DemoStatsService;
import pe.taskflow.board.model.Task;
import pe.taskflow.board.model.TaskEvent.TaskEventType;
import pe.taskflow.board.model.TaskPositionUpdate;
import pe.taskflow.board.repository.TaskRepository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TaskControllerTest {

    private static final Jwt ADMIN = Sesiones.admin();
    private static final Jwt TIENDA_1 = Sesiones.tienda(1);

    private static final int MAX_TASKS_PER_IP = 10;

    @Mock
    private TaskRepository taskRepository;
    @Mock
    private TaskEventPublisher eventPublisher;
    @Mock
    private ContentModerationService moderationService;
    @Mock
    private DemoStatsService statsService;
    @Mock
    private IncidenciaService incidenciaService;
    @Mock
    private OrdenService ordenService;

    private TaskController controller;

    @BeforeEach
    void setUp() {
        controller = new TaskController(taskRepository, eventPublisher, moderationService, statsService, incidenciaService, ordenService);
        lenient().when(incidenciaService.alCerrarTarea(any())).thenReturn(Mono.empty());
        lenient().when(ordenService.alCerrarTarea(any())).thenReturn(Mono.empty());
        // maxTasksPerIp llega por @Value en tiempo real; fuera de un ApplicationContext
        // hay que fijarlo a mano para que la lógica de rate limiting sea comprobable.
        ReflectionTestUtils.setField(controller, "maxTasksPerIp", MAX_TASKS_PER_IP);
    }

    @Test
    void creaUnaTareaCuandoNoHayViolacionesNiLimiteAlcanzado() {
        Task incoming = Task.builder().title("Escribir tests").status("TODO").position(1).build();
        Task saved = Task.builder().id(1L).title("Escribir tests").status("TODO").position(1).createdByIp("1.2.3.4").build();

        when(moderationService.isBlocked("1.2.3.4")).thenReturn(false);
        when(moderationService.findBlockedWord("Escribir tests", null)).thenReturn(Optional.empty());
        when(taskRepository.countByCreatedByIp("1.2.3.4")).thenReturn(Mono.just(3L));
        when(taskRepository.save(any(Task.class))).thenReturn(Mono.just(saved));

        var request = MockServerHttpRequest.post("/api/tasks")
                .header("X-Forwarded-For", "1.2.3.4")
                .build();

        StepVerifier.create(controller.create(incoming, request, ADMIN))
                .expectNext(saved)
                .verifyComplete();

        verify(eventPublisher).publish(TaskEventType.CREATED, saved);
        verify(statsService).recordTaskCreated();
    }

    @Test
    void rechazaCrearTareaConLenguajeOfensivo() {
        Task incoming = Task.builder().title("puta madre").status("TODO").position(1).build();

        when(moderationService.isBlocked("5.5.5.5")).thenReturn(false);
        when(moderationService.findBlockedWord("puta madre", null)).thenReturn(Optional.of("puta"));
        when(moderationService.recordViolation("5.5.5.5")).thenReturn(1);

        var request = MockServerHttpRequest.post("/api/tasks")
                .header("X-Forwarded-For", "5.5.5.5")
                .build();

        StepVerifier.create(controller.create(incoming, request, ADMIN))
                .expectErrorMatches(error -> error instanceof ResponseStatusException rse
                        && rse.getStatusCode() == HttpStatus.BAD_REQUEST)
                .verify();

        verify(taskRepository, never()).save(any());
    }

    @Test
    void bloqueaCreacionSiLaIpYaAcumuloElMaximoDeViolaciones() {
        Task incoming = Task.builder().title("hola").status("TODO").position(1).build();

        when(moderationService.isBlocked("6.6.6.6")).thenReturn(true);

        var request = MockServerHttpRequest.post("/api/tasks")
                .header("X-Forwarded-For", "6.6.6.6")
                .build();

        StepVerifier.create(controller.create(incoming, request, ADMIN))
                .expectErrorMatches(error -> error instanceof ResponseStatusException rse
                        && rse.getStatusCode() == HttpStatus.FORBIDDEN)
                .verify();

        verifyNoInteractions(taskRepository);
    }

    @Test
    void alLlegarAlLimiteRechazaLaTareaSinBorrarLasExistentes() {
        Task incoming = Task.builder().title("otra mas").status("TODO").position(1).build();

        when(moderationService.isBlocked("7.7.7.7")).thenReturn(false);
        when(moderationService.findBlockedWord("otra mas", null)).thenReturn(Optional.empty());
        when(taskRepository.countByCreatedByIp("7.7.7.7")).thenReturn(Mono.just((long) MAX_TASKS_PER_IP));

        var request = MockServerHttpRequest.post("/api/tasks")
                .header("X-Forwarded-For", "7.7.7.7")
                .build();

        StepVerifier.create(controller.create(incoming, request, ADMIN))
                .expectErrorMatches(error -> error instanceof ResponseStatusException rse
                        && rse.getStatusCode() == HttpStatus.TOO_MANY_REQUESTS)
                .verify();

        verify(taskRepository, never()).save(any());
        verify(eventPublisher, never()).publish(TaskEventType.RESET, null);
    }

    @Test
    void actualizaUnaTareaExistente() {
        Task existing = Task.builder().id(10L).title("vieja").status("TODO").position(1).build();
        Task incoming = Task.builder().title("nueva").status("IN_PROGRESS").position(2).build();

        when(moderationService.isBlocked(anyString())).thenReturn(false);
        when(moderationService.findBlockedWord("nueva", null)).thenReturn(Optional.empty());
        when(taskRepository.findById(10L)).thenReturn(Mono.just(existing));
        when(taskRepository.save(any(Task.class))).thenAnswer(invocation -> Mono.just(invocation.getArgument(0)));

        var request = MockServerHttpRequest.put("/api/tasks/10").build();

        StepVerifier.create(controller.update(10L, incoming, request, ADMIN))
                .expectNextMatches(task -> task.getTitle().equals("nueva") && task.getStatus().equals("IN_PROGRESS"))
                .verifyComplete();

        verify(eventPublisher).publish(eq(TaskEventType.UPDATED), any(Task.class));
    }

    @Test
    void actualizarUnaTareaInexistenteDevuelveNotFound() {
        Task incoming = Task.builder().title("nueva").status("TODO").position(1).build();

        when(moderationService.isBlocked(anyString())).thenReturn(false);
        when(moderationService.findBlockedWord("nueva", null)).thenReturn(Optional.empty());
        when(taskRepository.findById(999L)).thenReturn(Mono.empty());

        var request = MockServerHttpRequest.put("/api/tasks/999").build();

        StepVerifier.create(controller.update(999L, incoming, request, ADMIN))
                .expectErrorMatches(error -> error instanceof ResponseStatusException rse
                        && rse.getStatusCode() == HttpStatus.NOT_FOUND)
                .verify();
    }

    @Test
    void borraUnaTareaExistente() {
        when(taskRepository.findById(5L)).thenReturn(Mono.just(Task.builder().id(5L).tiendaId(1L).tipo("MANUAL").build()));
        when(taskRepository.deleteById((Long) 5L)).thenReturn(Mono.empty());

        StepVerifier.create(controller.delete(5L, TIENDA_1)).verifyComplete();

        verify(eventPublisher).publish(eq(TaskEventType.DELETED), any(Task.class));
    }

    @Test
    void borrarUnaTareaInexistenteDevuelveNotFound() {
        when(taskRepository.findById(404L)).thenReturn(Mono.empty());

        StepVerifier.create(controller.delete(404L, ADMIN))
                .expectErrorMatches(error -> error instanceof ResponseStatusException rse
                        && rse.getStatusCode() == HttpStatus.NOT_FOUND)
                .verify();

        verify(taskRepository, never()).deleteById(any(Long.class));
    }

    @Test
    void reordenaVariasTareasEnUnaSolaLlamada() {
        Task task1 = Task.builder().id(1L).title("A").status("TODO").position(0).build();
        Task task2 = Task.builder().id(2L).title("B").status("TODO").position(1).build();

        when(taskRepository.findById(1L)).thenReturn(Mono.just(task1));
        when(taskRepository.findById(2L)).thenReturn(Mono.just(task2));
        when(taskRepository.save(any(Task.class))).thenAnswer(invocation -> Mono.just(invocation.getArgument(0)));

        List<TaskPositionUpdate> updates = List.of(
                new TaskPositionUpdate(1L, "IN_PROGRESS", 0),
                new TaskPositionUpdate(2L, "IN_PROGRESS", 1)
        );

        StepVerifier.create(controller.reorder(updates, ADMIN))
                .expectNextMatches(t -> t.getId().equals(1L) && t.getStatus().equals("IN_PROGRESS"))
                .expectNextMatches(t -> t.getId().equals(2L) && t.getStatus().equals("IN_PROGRESS"))
                .verifyComplete();

        verify(eventPublisher, times(2)).publish(eq(TaskEventType.UPDATED), any(Task.class));
    }

    @Test
    void unaTiendaCreaSusTareasSoloEnSuSede() {
        Task incoming = Task.builder().title("Contar caja").status("TODO").position(1).tiendaId(3L).build();

        when(moderationService.isBlocked(anyString())).thenReturn(false);
        when(moderationService.findBlockedWord("Contar caja", null)).thenReturn(Optional.empty());
        when(taskRepository.countByCreatedByIp(anyString())).thenReturn(Mono.just(0L));
        when(taskRepository.save(any(Task.class))).thenAnswer(invocation -> Mono.just(invocation.getArgument(0)));

        StepVerifier.create(controller.create(incoming, MockServerHttpRequest.post("/api/tasks").build(), TIENDA_1))
                .expectNextMatches(t -> t.getTiendaId() == 1L && "MANUAL".equals(t.getTipo()) && "tienda1".equals(t.getCreadoPor()))
                .verifyComplete();
    }

    @Test
    void unaTiendaNoPuedeMoverTareasDeOtra() {
        when(taskRepository.findById(9L)).thenReturn(Mono.just(Task.builder().id(9L).tiendaId(2L).status("TODO").build()));

        StepVerifier.create(controller.reorder(List.of(new TaskPositionUpdate(9L, "DONE", 1)), TIENDA_1))
                .expectErrorMatches(error -> error instanceof ResponseStatusException rse
                        && rse.getStatusCode() == HttpStatus.FORBIDDEN)
                .verify();

        verify(taskRepository, never()).save(any());
    }

    @Test
    void unaTiendaNoBorraLasTareasAutomaticas() {
        when(taskRepository.findById(8L)).thenReturn(Mono.just(Task.builder().id(8L).tiendaId(1L).tipo("REPOSICION").build()));

        StepVerifier.create(controller.delete(8L, TIENDA_1))
                .expectErrorMatches(error -> error instanceof ResponseStatusException rse
                        && rse.getStatusCode() == HttpStatus.FORBIDDEN)
                .verify();

        verify(taskRepository, never()).deleteById(any(Long.class));
    }

    @Test
    void cerrarUnaTareaGuardaCuandoSeCerro() {
        when(taskRepository.findById(4L)).thenReturn(Mono.just(Task.builder().id(4L).tiendaId(1L).status("IN_PROGRESS").build()));
        when(taskRepository.save(any(Task.class))).thenAnswer(invocation -> Mono.just(invocation.getArgument(0)));

        StepVerifier.create(controller.reorder(List.of(new TaskPositionUpdate(4L, "DONE", 1)), TIENDA_1))
                .expectNextMatches(t -> t.getCerradaEn() != null)
                .verifyComplete();

        verify(incidenciaService).alCerrarTarea(any(Task.class));
    }
}
