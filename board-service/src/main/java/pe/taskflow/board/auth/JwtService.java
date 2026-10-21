package pe.taskflow.board.auth;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusReactiveJwtDecoder;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;

/** Firma y valida los JWT (HS256) con una sola clave compartida. */
@Service
public class JwtService {

    private static final Logger log = LoggerFactory.getLogger(JwtService.class);
    static final Duration DURACION = Duration.ofHours(12);

    private final SecretKey clave;
    private final NimbusJwtEncoder encoder;

    public JwtService(@Value("${app.auth.jwt-secret:}") String secreto) {
        byte[] bytes = secreto.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            // Sin JWT_SECRET cada arranque usa una clave nueva: las sesiones anteriores caducan.
            log.warn("JWT_SECRET no definido o con menos de 32 bytes: se usa una clave aleatoria");
            bytes = new byte[32];
            new SecureRandom().nextBytes(bytes);
        }
        this.clave = new SecretKeySpec(bytes, "HmacSHA256");
        this.encoder = new NimbusJwtEncoder(new ImmutableSecret<>(clave));
    }

    public SesionResponse emitir(Usuario u, String tiendaNombre) {
        Instant ahora = Instant.now();
        Instant expira = ahora.plus(DURACION);
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder()
                .issuer("taskflow")
                .subject(u.getUsuario())
                .issuedAt(ahora)
                .expiresAt(expira)
                .claim("nombre", u.getNombre())
                .claim("rol", u.getRol());
        if (u.getTiendaId() != null) {
            claims.claim("tiendaId", u.getTiendaId());
        }
        String token = encoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).build(), claims.build())).getTokenValue();
        return new SesionResponse(token, expira,
                new SesionResponse.Perfil(u.getUsuario(), u.getNombre(), u.getRol(), u.getTiendaId(), tiendaNombre));
    }

    public ReactiveJwtDecoder decoder() {
        return NimbusReactiveJwtDecoder.withSecretKey(clave).macAlgorithm(MacAlgorithm.HS256).build();
    }
}
