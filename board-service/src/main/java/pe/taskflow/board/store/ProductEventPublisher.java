package pe.taskflow.board.store;

import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Sinks;

/**
 * Publica cada cambio de stock (compras, reposición diaria) a todos los
 * visitantes conectados a la tienda, para que el stock se vea igual en
 * tiempo real para cualquiera que la tenga abierta.
 */
@Component
public class ProductEventPublisher {

    private final Sinks.Many<Product> sink = Sinks.many().multicast().onBackpressureBuffer();

    public void publish(Product product) {
        sink.tryEmitNext(product);
    }

    public Flux<Product> stream() {
        return sink.asFlux();
    }
}
