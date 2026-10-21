package pe.taskflow.board.gestion;

import org.springframework.r2dbc.core.DatabaseClient.GenericExecuteSpec;

/** Ayudas para las consultas con filtros opcionales (p. ej. "todas las tiendas"). */
public final class Sql {

    private Sql() {
    }

    public static GenericExecuteSpec bindOrNull(GenericExecuteSpec spec, String nombre, Object valor, Class<?> tipo) {
        return valor == null ? spec.bindNull(nombre, tipo) : spec.bind(nombre, valor);
    }
}
