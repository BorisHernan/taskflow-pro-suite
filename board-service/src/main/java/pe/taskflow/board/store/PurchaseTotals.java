package pe.taskflow.board.store;

import java.math.BigDecimal;

public record PurchaseTotals(long compras, long unidades, BigDecimal ingresos) {

    public static final PurchaseTotals VACIO = new PurchaseTotals(0, 0, BigDecimal.ZERO);
}
