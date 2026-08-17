package pe.taskflow.board.demo;

import org.springframework.data.r2dbc.repository.Modifying;
import org.springframework.data.r2dbc.repository.Query;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Mono;

public interface VisitCounterRepository extends ReactiveCrudRepository<VisitCounter, Integer> {

    /**
     * Una sola sentencia atómica: intenta registrar la IP en visit_log para
     * hoy (ON CONFLICT DO NOTHING si ya visitó hoy), y solo si esa inserción
     * ocurrió de verdad, suma 1 a visit_counter. Así refrescar la página o
     * abrir varias pestañas desde la misma IP el mismo día no infla el total,
     * y sigue siendo seguro con visitas simultáneas de IPs distintas.
     */
    @Modifying
    @Query("""
            WITH inserted AS (
                INSERT INTO visit_log (ip, visit_date) VALUES (:ip, CURRENT_DATE)
                ON CONFLICT DO NOTHING
                RETURNING ip
            )
            UPDATE visit_counter
            SET total_visits = total_visits + 1, last_visit_at = now()
            WHERE id = 1 AND EXISTS (SELECT 1 FROM inserted)
            """)
    Mono<Integer> incrementIfNewVisitorToday(String ip);

    /** Se llama desde el reset diario: las filas de días pasados ya cumplieron su función. */
    @Modifying
    @Query("DELETE FROM visit_log WHERE visit_date < CURRENT_DATE")
    Mono<Integer> deleteOldVisitLogEntries();
}
