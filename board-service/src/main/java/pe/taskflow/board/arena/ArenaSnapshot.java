package pe.taskflow.board.arena;

import java.util.List;

/** Estado completo del arena, transmitido a todos los conectados en cada tick. */
public record ArenaSnapshot(List<BlobView> blobs, List<Pellet> pellets, double worldSize) {
}
