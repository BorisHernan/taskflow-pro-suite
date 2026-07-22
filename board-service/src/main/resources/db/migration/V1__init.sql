CREATE TABLE tasks (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'TODO',
    position INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

INSERT INTO tasks (title, description, status, position) VALUES
('Diseñar el modelo de datos', 'Definir tablas y relaciones iniciales', 'DONE', 1),
('Crear board-service', 'Endpoints CRUD reactivos con WebFlux', 'IN_PROGRESS', 1),
('Conectar Angular con la API', 'Consumir /api/tasks desde el frontend', 'TODO', 1),
('Agregar autenticación con Keycloak', 'Proteger endpoints con JWT', 'TODO', 2);
