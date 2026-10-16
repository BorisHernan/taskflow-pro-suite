package pe.taskflow.board.arena;

/** Vista pública (inmutable) de una célula para enviar por WebSocket. */
public record BlobView(String id, String ownerId, String name, double x, double y, double radius, String color,
                       String skin, boolean bot, boolean velocidad, boolean escudo, boolean iman) {

    static BlobView from(Blob blob) {
        return new BlobView(blob.getId(), blob.getOwnerId(), blob.getName(), blob.getX(), blob.getY(),
                blob.getRadius(), blob.getColor(), blob.getSkin(), blob.isBot(),
                blob.getVelocidadTicks() > 0, blob.getEscudoTicks() > 0, blob.getImanTicks() > 0);
    }
}
