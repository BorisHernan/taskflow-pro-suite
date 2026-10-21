package pe.taskflow.board.gestion;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import pe.taskflow.board.demo.ContentModerationService;

/** Los textos libres de gestión pasan por el mismo filtro de lenguaje que el resto de la demo. */
@Component
@RequiredArgsConstructor
public class FiltroDeTexto {

    private final ContentModerationService moderation;

    public void revisar(String... textos) {
        if (moderation.findBlockedWord(textos).isPresent()) {
            throw Errores.invalido("Evita lenguaje ofensivo: esta demo es pública y compartida.");
        }
    }
}
