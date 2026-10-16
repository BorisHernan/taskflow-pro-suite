package pe.taskflow.board.config;

import org.junit.jupiter.api.Test;
import pe.taskflow.board.model.Task;
import pe.taskflow.board.model.TaskEvent.TaskEventType;
import reactor.core.Disposable;
import reactor.test.StepVerifier;

import java.time.Duration;

class TaskEventPublisherTest {

    // Lo que pasa en producción: un visitante se conecta y se va (el stream queda
    // sin suscriptores), y después llega otro. El segundo tiene que seguir
    // recibiendo los cambios; antes el sink quedaba muerto para siempre.
    @Test
    void sigueEmitiendoDespuesDeQueSeVaElUltimoSuscriptor() {
        TaskEventPublisher publisher = new TaskEventPublisher();

        Disposable primerVisitante = publisher.stream().subscribe();
        primerVisitante.dispose();

        Task tarea = Task.builder().id(1L).title("Prueba").status("DONE").build();

        StepVerifier.create(publisher.stream())
                .then(() -> publisher.publish(TaskEventType.UPDATED, tarea))
                .expectNextMatches(e -> e.type() == TaskEventType.UPDATED && e.task() == tarea)
                .thenCancel()
                .verify(Duration.ofSeconds(2));
    }

    // Lo publicado sin nadie escuchando se descarta: un visitante nuevo no debe
    // recibir de golpe cambios viejos que pisen el tablero que acaba de cargar.
    @Test
    void noLeReenviaEventosViejosAUnVisitanteNuevo() {
        TaskEventPublisher publisher = new TaskEventPublisher();
        Task vieja = Task.builder().id(1L).title("Vieja").status("TODO").build();
        Task nueva = Task.builder().id(2L).title("Nueva").status("DONE").build();

        publisher.publish(TaskEventType.UPDATED, vieja);

        StepVerifier.create(publisher.stream())
                .then(() -> publisher.publish(TaskEventType.UPDATED, nueva))
                .expectNextMatches(e -> e.task() == nueva)
                .thenCancel()
                .verify(Duration.ofSeconds(2));
    }
}
