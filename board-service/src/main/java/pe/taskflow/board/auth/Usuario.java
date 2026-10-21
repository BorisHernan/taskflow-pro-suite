package pe.taskflow.board.auth;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table("usuarios")
public class Usuario {

    public static final String ADMIN = "ADMIN";
    public static final String TIENDA = "TIENDA";

    @Id
    private Long id;
    private String usuario;
    private String nombre;
    private String claveHash;
    private String rol;
    private Long tiendaId;
    private Boolean activo;
}
