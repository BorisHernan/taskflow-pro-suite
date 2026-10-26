package pe.taskflow.board.ventas;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;

/** Cupones válidos. El descuento lo calcula el servidor: el navegador solo lo muestra. */
public final class Cupones {

    private static final Map<String, BigDecimal> DESCUENTOS = Map.of(
            "BIENVENIDO10", new BigDecimal("0.10"),
            "PORTAFOLIO15", new BigDecimal("0.15"),
            "DEVOPS20", new BigDecimal("0.20"));

    private Cupones() {
    }

    public static Optional<BigDecimal> descuentoDe(String codigo) {
        return codigo == null ? Optional.empty() : Optional.ofNullable(DESCUENTOS.get(codigo.trim().toUpperCase()));
    }
}
