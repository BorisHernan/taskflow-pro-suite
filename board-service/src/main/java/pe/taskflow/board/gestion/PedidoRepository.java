package pe.taskflow.board.gestion;

import org.springframework.data.repository.reactive.ReactiveCrudRepository;

public interface PedidoRepository extends ReactiveCrudRepository<Pedido, Long> {
}
