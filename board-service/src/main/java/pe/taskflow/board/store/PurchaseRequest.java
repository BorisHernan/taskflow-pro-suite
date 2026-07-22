package pe.taskflow.board.store;

import jakarta.validation.constraints.Min;

public record PurchaseRequest(@Min(1) int quantity) {
}
