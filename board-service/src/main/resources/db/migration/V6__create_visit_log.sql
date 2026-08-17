-- Una fila por IP por día: sirve para deduplicar visitas (refrescar la
-- página o abrir varias pestañas desde la misma IP el mismo día no debe
-- sumar de nuevo a visit_counter.total_visits).
CREATE TABLE visit_log (
    ip VARCHAR(64) NOT NULL,
    visit_date DATE NOT NULL,
    PRIMARY KEY (ip, visit_date)
);
