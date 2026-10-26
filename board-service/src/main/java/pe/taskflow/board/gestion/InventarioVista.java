package pe.taskflow.board.gestion;

import java.math.BigDecimal;

/** Fila del inventario con los datos del producto, para la pantalla de stock. */
public record InventarioVista(
        long id,
        long tiendaId,
        long productoId,
        String producto,
        String categoria,
        String icono,
        BigDecimal precio,
        int stock,
        int stockMinimo,
        int stockObjetivo,
        int almacen,
        String estado,
        boolean pedidoEnCurso
) {

    public static final String AGOTADO = "AGOTADO";
    public static final String BAJO = "BAJO";
    public static final String OK = "OK";

    public static String estadoDe(int stock, int minimo) {
        if (stock == 0) {
            return AGOTADO;
        }
        return stock <= minimo ? BAJO : OK;
    }
}
