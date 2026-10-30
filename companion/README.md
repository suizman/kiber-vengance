# КИБЕР VENGANCE · Companion

**Canto local para el estudio, con modelos descargados por separado.**

[Descargar instalador](https://github.com/suizman/kiber-vengance/releases/latest) · [Manual de voz y canto](https://github.com/suizman/kiber-vengance/blob/master/docs/wiki/Voz-y-canto.md)

![Diálogo de canto del estudio](https://github.com/suizman/kiber-vengance/blob/master/docs/wiki/assets/desktop-vocals.png?raw=true)

*Captura de interfaz con fixture HTTP; no es evidencia de audio generado por un modelo.*

## Instalar y conectar

| Sistema | Paquete |
| --- | --- |
| macOS 13+ | DMG `arm64` para Apple Silicon o `x86_64` para Intel; copiar a Applications |
| Windows x64 | Instalador por usuario, con desinstalador y manejador de URL |
| Linux x86_64 | AppImage, Arch/Ubuntu; sin FUSE usa `--appimage-extract-and-run` |

Los instaladores están en el repositorio privado: necesitas acceso GitHub. Python está incluido. Mac usa firma ad-hoc, sin notarización; Windows no tiene certificado de editor.

1. Abre el companion e instala el runtime y modelo/banco elegido, tras revisar sus licencias.
2. En el estudio, abre **Arrange → Audio & sampler → Singing · Desktop**.
3. Introduce el código de seis cifras y permite red local si el navegador lo solicita.
4. Genera, escucha Original/Processed y descarga WAV o inserta una nueva región.

## Motores

**DiffSinger** sigue notas monofónicas y sílabas: `+` prolonga una vocal, `_` crea silencio. Ofrece fonemas, vibrato, portamento y controles compatibles con el banco. Necesita banco y vocoder ONNX compatibles.

**ACE-Step** propone música desde letra, estilo, BPM, duración y semilla. Puede incluir acompañamiento: no garantiza notas exactas ni voz aislada. No está disponible en Mac Intel por la dependencia PyTorch.

CPU es la base; Apple/CoreML, DirectML, CUDA o AMD dependen del motor, runtime y drivers. En 1.0.2+, el vocoder usa CPU cuando el acústico usa CoreML. El perfil instalado y el dispositivo de generación son controles distintos. No se prometen benchmarks de GPU sin medir el hardware.

## Datos y mantenimiento

Un solo trabajo pesado a la vez; Cancel termina su proceso y los trabajos completados se pueden recuperar. Actualizar la aplicación conserva modelos y WAVs. **Reinicia el proceso anterior al instalar una actualización.** Repair y Delete model gestionan runtime/pesos por separado del proyecto.

Datos: Linux `$XDG_DATA_HOME/kiber-vengance` o `~/.local/share/kiber-vengance`; Mac `~/Library/Application Support/KiberVengance`; Windows `%LOCALAPPDATA%/KiberVengance`. Project Package respalda audio insertado, no pesos.

Kaiz incluye un vocoder **CC-BY-NC 4.0**: no se presenta como autorizado para música comercial. Software GPL-3.0-or-later; [avisos de terceros](https://github.com/suizman/kiber-vengance/blob/master/companion/THIRD_PARTY.md).

[Desarrollo, packaging y publicación](https://github.com/suizman/kiber-vengance/blob/master/docs/wiki/Desarrollo.md) · [Licencias, hashes y evidencia](https://github.com/suizman/kiber-vengance/blob/master/docs/DESKTOP_VOCALS.md).
