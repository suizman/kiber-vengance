# Mezcla

## Canales y buses

Mix reúne pistas instrumentales y lanes de audio. Ajusta pre-gain, fader en dB, pan, color, Solo/Mute, grupos y sends pre/post. **Solo es exclusivo**; al desactivarlo vuelve la mezcla. Los cambios afectan a voces/regiones sostenidas y al render exportado.

Los medidores estéreo muestran RMS/peak, peak hold y nivel de señal dBFS. Un fader en dB es un ajuste de ganancia, no el nivel medido. Los controles comparten silencio exacto, reset a unidad, entrada numérica y ajuste fino.

El routing incluye grupos y ducking sidechain disparado por kick. **Master FX** permite bypass; **Mono** comprueba compatibilidad. Target LUFS y ceiling ayudan al acabado, junto con una lectura momentánea aproximada de LUFS y comparación A/B compensada.

## Program, decks, Master y Cue

- **Program** controla la composición y sus pistas de audio.
- Los niveles A/B y su crossfader controlan los decks; Program/Deck decide el balance con la composición.
- **Master** controla la suma final que llega a altavoces y Record Take.
- **Preview** tiene nivel propio; se escucha, pero no entra en la toma ni en la exportación.
- **Cue** tiene nivel y destino separados, cuando el navegador lo permite.

La cabecera Master, Mix y Live comparten los mismos valores persistidos. Los efectos de región/lane son no destructivos y admiten Original/Processed y dry/wet en los flujos correspondientes.

## Límites que afectan al resultado

El limitador es protección dinámica, no una garantía de true peak brickwall. LUFS-M es aproximado. Los buses en directo y el render offline no son bit idénticos: colas por pista/clip, excitación aleatoria, reverberación y algunos parámetros al inicio de nota pueden diferir.

Los stems instrumentales aíslan instrumentos y las lanes de audio tienen stems propios. Para capturar la mezcla final con scratching, utiliza Record Take.

[Exportación](Proyectos-y-exportacion.md) · [DSP y evidencia técnica](../AUDIO_MIX_AND_VOICE.md).
