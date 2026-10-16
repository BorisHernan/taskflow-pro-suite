package pe.taskflow.board.store;

/** Promedio y cantidad de reseñas de un producto, para las estrellas del catálogo. */
public record RatingSummary(Long productId, Double average, Long count) {
}
