package pe.taskflow.board.store;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/** tiendaId: sede donde se compra; sin ella, la tienda principal. */
public record PurchaseRequest(@Min(1) @Max(50) int quantity, Long tiendaId) {
}
