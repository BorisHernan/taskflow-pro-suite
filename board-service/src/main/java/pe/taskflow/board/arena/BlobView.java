package pe.taskflow.board.arena;

/** Vista pública (inmutable) de un Blob para enviar por WebSocket. */
public record BlobView(String id, String name, double x, double y, double radius, String color, boolean bot) {

    static BlobView from(Blob blob) {
        return new BlobView(blob.getId(), blob.getName(), blob.getX(), blob.getY(), blob.getRadius(),
                blob.getColor(), blob.isBot());
    }
}
