package pe.taskflow.board.gestion;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pe.taskflow.board.auth.UsuarioActual;
import pe.taskflow.board.gestion.PersonalService.EmpleadoVista;
import pe.taskflow.board.model.Task;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/** Plantilla de la sede, ausencias y asignación de tareas. */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Tag(name = "Personal", description = "Quién trabaja, quién está libre y quién hace cada tarea")
public class PersonalController {

    private final PersonalService service;

    @Operation(summary = "Personal de la sede con su estado actual (trabajando, disponible, fuera de turno o ausente)")
    @GetMapping("/personal")
    public Flux<EmpleadoVista> listar(@AuthenticationPrincipal Jwt jwt, @RequestParam(required = false) Long tienda) {
        return service.listar(UsuarioActual.de(jwt), tienda);
    }

    @Operation(summary = "Mueve a la persona a un puesto de la tienda (caja, entrada, pasillos…) y le envía el aviso")
    @PutMapping("/personal/{id}/puesto")
    public Mono<EmpleadoVista> puesto(@AuthenticationPrincipal Jwt jwt, @PathVariable long id,
                                      @Valid @RequestBody Solicitudes.CambioPuesto req) {
        return service.moverAPuesto(UsuarioActual.de(jwt), id, req.puesto());
    }

    @Operation(summary = "Últimos avisos enviados al personal de la sede")
    @GetMapping("/personal/avisos")
    public Flux<PersonalService.Aviso> avisos(@AuthenticationPrincipal Jwt jwt, @RequestParam(required = false) Long tienda) {
        return service.avisos(UsuarioActual.de(jwt), tienda);
    }

    @Operation(summary = "Registra una ausencia: descanso médico, vacaciones, permiso o día libre")
    @PutMapping("/personal/{id}/ausencia")
    public Mono<EmpleadoVista> ausencia(@AuthenticationPrincipal Jwt jwt, @PathVariable long id,
                                        @Valid @RequestBody Solicitudes.Ausencia req) {
        return service.ausencia(UsuarioActual.de(jwt), id, req);
    }

    @Operation(summary = "La persona vuelve a estar activa")
    @DeleteMapping("/personal/{id}/ausencia")
    public Mono<EmpleadoVista> reincorporar(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        return service.reincorporar(UsuarioActual.de(jwt), id);
    }

    @Operation(summary = "Asigna la tarea a una persona disponible; avanza sola según el tiempo estimado")
    @PostMapping("/tasks/{id}/asignar")
    public Mono<Task> asignar(@AuthenticationPrincipal Jwt jwt, @PathVariable long id, @Valid @RequestBody Solicitudes.Asignacion req) {
        return service.asignar(UsuarioActual.de(jwt), id, req.empleadoId(), Boolean.TRUE.equals(req.rapido()));
    }

    /** Cada 15 s se cierran las tareas cuyo tiempo estimado ya pasó. */
    @Scheduled(fixedDelay = 15_000, initialDelay = 15_000)
    void avanzarTareas() {
        service.completarVencidas().onErrorResume(e -> Mono.empty()).subscribe();
    }
}
