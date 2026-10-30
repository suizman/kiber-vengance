# Voz y canto en escritorio

## Voz hablada en el navegador

En **Arrange → Audio & sampler → VOICE · ES/EN**, elige texto, idioma, voz y velocidad; carga el modelo explícitamente, genera, escucha o descarga WAV e inserta una nueva región.

**Kokoro** ofrece inglés Heart/Michael y español Dora/Alex; velocidad 0.6–1.5 y precisión q8/FP32. q8 descarga aproximadamente 90 MB y FP32 330 MB, más voces/runtime/fonemas. Un salto de línea crea un fragmento con velocidad y silencio posterior propios. Es control de ritmo de habla, no instrucciones emocionales libres.

**Chatterbox** es experimental, CPU y de escritorio: descarga aproximadamente 568 MB más runtime, puede tardar minutos y ofrece intensidad contenida/natural/enfática. En equipos que reportan 4 GB RAM o menos se ofrece Kokoro. No se ofrece el backend WebGPU experimental como una generación funcional, ni instrucciones libres Qwen.

El destino de inserción captura pista y cursor al empezar. Cada inserción crea una región distinta con fuente WAV y procedencia; Undo/Redo, efectos, reload y Package la conservan. Original/Processed permite escuchar/descargar el tratamiento sin reemplazar el audio fuente.

Melodía y voz comparten bloqueo de inferencia. Cancelar termina el worker y conserva el resultado previo; Free memory y Delete downloads gestionan las cachés de modelos separadamente del proyecto.

## Canto mediante companion

![Diálogo de canto de escritorio](assets/desktop-vocals.png)

*Interfaz real en una prueba de protocolo HTTP; el fixture no es audio de un modelo.*

Descarga el [companion publicado](https://github.com/suizman/kiber-vengance/releases/latest), ábrelo, instala runtime/modelo y conecta **Singing · Desktop** con su código de seis cifras. El navegador puede pedir permiso de red local. Los instaladores requieren acceso al repositorio privado.

| Motor | Entrada y resultado |
| --- | --- |
| DiffSinger | Clip monofónico y sílabas por nota; `+` prolonga vocal, `_` es silencio; fonemas editables, vibrato, portamento y expresiones del banco. Hasta 256 notas/120 s. Rechaza solapamientos. Necesita banco ONNX y vocoder compatibles |
| ACE-Step 1.5 | Letra, estilo, ES/EN, BPM, duración 10–120 s y semilla. Crea una propuesta musical que puede incluir acompañamiento; no garantiza melodía exacta ni voz aislada |

Ambos permiten progreso, cancelación, preview Original/Processed, WAV, inserción no destructiva y recuperación de trabajos terminados. Solo se ejecuta un trabajo pesado a la vez. Los modelos se descargan aparte; actualizar la app no los borra.

## Instalación y solución de problemas

macOS: DMG separado Apple Silicon/Intel, macOS 13+; Windows x64: instalador por usuario; Linux x86_64: AppImage Arch/Ubuntu, con `--appimage-extract-and-run` si no hay FUSE. Python va incluido. Firma Mac ad-hoc, sin notarización; Windows sin certificado de editor.

Intel usa ONNX Runtime 1.23.2 y no ofrece ACE-Step por falta del PyTorch requerido. En 1.0.2+, CoreML puede ejecutar el modelo acústico y el vocoder usa CPU para evitar el fallo de longitud dinámica. **Perfil instalado CPU** y **dispositivo de generación CPU/Automatic** son controles distintos. Selecciona CPU como solución de compatibilidad y reinicia el proceso anterior al actualizar.

Kaiz incluye un vocoder **CC-BY-NC 4.0**: no está autorizado aquí para lanzamientos comerciales. Revisa licencias de cada banco/vocoder o importa uno compatible con permisos adecuados. Los pesos no van en Project Package.

[Guía técnica, hashes y evidencia](../DESKTOP_VOCALS.md) · [Speech técnico](../LOCAL_VOICE.md) · [Compatibilidad](Compatibilidad-y-licencias.md).
