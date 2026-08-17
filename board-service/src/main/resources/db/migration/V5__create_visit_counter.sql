-- Fila única (patrón singleton) que guarda el total histórico de visitas.
-- A diferencia de los contadores de DemoStatsService (en memoria, se
-- reinician con cada deploy), esta tabla sobrevive a reinicios y deploys.
CREATE TABLE visit_counter (
    id INTEGER PRIMARY KEY DEFAULT 1,
    total_visits BIGINT NOT NULL DEFAULT 0,
    last_visit_at TIMESTAMP,
    CONSTRAINT visit_counter_single_row CHECK (id = 1)
);

INSERT INTO visit_counter (id, total_visits) VALUES (1, 0);
