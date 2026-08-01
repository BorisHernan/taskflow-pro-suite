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
import pe.taskflow.board.config.TaskEventPublisher;
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

    private static final int MAX_TASKS_PER_IP = 50;

    @Mock
    private TaskRepository taskRepository;
    @Mock
    private TaskEventPublisher eventPublisher;
    @Mock
    private ContentModerationService moderationService;
    @Mock
    private DemoStatsService statsService;

    private TaskController controller;

    @BeforeEach
    void setUp() {
        controller = new TaskController(taskRepository, eventPublisher, moderationService, statsService);
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

        StepVerifier.create(controller.create(incoming, request))
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

        StepVerifier.create(controller.create(incoming, request))
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

        StepVerifier.create(controller.create(incoming, request))
                .expectErrorMatches(error -> error instanceof ResponseStatusException rse
                        && rse.getStatusCode() == HttpStatus.FORBIDDEN)
                .verify();

        verifyNoInteractions(taskRepository);
    }

    @Test
    void borraTodasLasTareasDeLaIpAlAlcanzarElLimite() {
        Task incoming = Task.builder().title("otra mas").status("TODO").position(1).build();

        when(moderationService.isBlocked("7.7.7.7")).thenReturn(false);
        when(moderationService.findBlockedWord("otra mas", null)).thenReturn(Optional.empty());
        when(taskRepository.countByCreatedByIp("7.7.7.7")).thenReturn(Mono.just((long) MAX_TASKS_PER_IP));
        when(taskRepository.deleteByCreatedByIp("7.7.7.7")).thenReturn(Mono.empty());

        var request = MockServerHttpRequest.post("/api/tasks")
                .header("X-Forwarded-For", "7.7.7.7")
                .build();

        StepVerifier.create(controller.create(incoming, request))
                .expectErrorMatches(error -> error instanceof ResponseStatusException rse
                        && rse.getStatusCode() == HttpStatus.TOO_MANY_REQUESTS)
                .verify();

        verify(taskRepository).deleteByCreatedByIp("7.7.7.7");
        verify(eventPublisher).publish(TaskEventType.RESET, null);
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

        StepVerifier.create(controller.update(10L, incoming, request))
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

        StepVerifier.create(controller.update(999L, incoming, request))
                .expectErrorMatches(error -> error instanceof ResponseStatusException rse
                        && rse.getStatusCode() == HttpStatus.NOT_FOUND)
                .verify();
    }

    @Test
    void borraUnaTareaExistente() {
        when(taskRepository.existsById(5L)).thenReturn(Mono.just(true));
        when(taskRepository.deleteById((Long) 5L)).thenReturn(Mono.empty());

        StepVerifier.create(controller.delete(5L)).verifyComplete();

        verify(eventPublisher).publish(eq(TaskEventType.DELETED), any(Task.class));
    }

    @Test
    void borrarUnaTareaInexistenteDevuelveNotFound() {
        when(taskRepository.existsById(404L)).thenReturn(Mono.just(false));

        StepVerifier.create(controller.delete(404L))
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

        StepVerifier.create(controller.reorder(updates))
                .expectNextMatches(t -> t.getId().equals(1L) && t.getStatus().equals("IN_PROGRESS"))
                .expectNextMatches(t -> t.getId().equals(2L) && t.getStatus().equals("IN_PROGRESS"))
                .verifyComplete();

        verify(eventPublisher, times(2)).publish(eq(TaskEventType.UPDATED), any(Task.class));
    }
}
