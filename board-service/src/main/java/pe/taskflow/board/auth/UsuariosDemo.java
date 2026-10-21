package pe.taskflow.board.auth;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;

import java.util.List;

/**
 * Cuentas públicas de la demo (la clave se muestra en la pantalla de login).
 * Se crean al arrancar si no existen; las que ya están no se tocan.
 */
@Component
@RequiredArgsConstructor
public class UsuariosDemo implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(UsuariosDemo.class);

    record Cuenta(String usuario, String nombre, String rol, String codigoTienda) {
    }

    static final List<Cuenta> CUENTAS = List.of(
            new Cuenta("admin", "Ana Torres", Usuario.ADMIN, null),
            new Cuenta("miraflores", "Luis Quispe", Usuario.TIENDA, "T01"),
            new Cuenta("sanisidro", "María Rojas", Usuario.TIENDA, "T02"),
            new Cuenta("surco", "Carlos Díaz", Usuario.TIENDA, "T03"));

    private final DatabaseClient db;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.auth.demo-password:demo1234}")
    private String claveDemo;

    @Override
    public void run(ApplicationArguments args) {
        String hash = passwordEncoder.encode(claveDemo);
        Flux.fromIterable(CUENTAS)
                .concatMap(c -> db.sql("""
                                INSERT INTO usuarios (usuario, nombre, clave_hash, rol, tienda_id)
                                VALUES (:usuario, :nombre, :hash, :rol, (SELECT id FROM tiendas WHERE codigo = :codigo))
                                ON CONFLICT (usuario) DO NOTHING""")
                        .bind("usuario", c.usuario())
                        .bind("nombre", c.nombre())
                        .bind("hash", hash)
                        .bind("rol", c.rol())
                        .bind("codigo", c.codigoTienda() == null ? "" : c.codigoTienda())
                        .fetch().rowsUpdated())
                .reduce(0L, Long::sum)
                .doOnNext(n -> {
                    if (n > 0) {
                        log.info("Cuentas demo creadas: {}", n);
                    }
                })
                .doOnError(err -> log.error("No se pudieron crear las cuentas demo", err))
                .onErrorComplete()
                .block();
    }
}
