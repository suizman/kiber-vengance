# Sonido y presets

## Instrumentos y carácter

| Instrumento | Controles y usos |
| --- | --- |
| Lead, bajo y pad | Osciladores, formas de onda, ADSR, filtro/cutoff/resonancia, unison, detune, glide y panorama |
| Guitarra | Cuerda pulsada sintética: ataque de púa, armónicos y resonancia de cuerpo |
| Batería | Kick, snare, hats cerrado/abierto, tom, percusión y crash; síntesis o muestras locales |

**Sound** abre el inspector compartido. El preset y los parámetros del instrumento se guardan **por clip**. Cambiar de clip restaura su sonido, arp, LFO, efectos y seis macros: energía, oscuridad, tensión, agresividad, espacio y complejidad.

El diseño de sonido incluye distorsión, saturación, chorus, delay, reverb y tono/EQ. Los racks se pliegan y Focus oculta controles secundarios. Los diales admiten arrastre, ajuste fino con Shift, teclado y botones −/+. Volumen, pan y routing de canal permanecen en la pista al cargar presets.

## Preset Vault y catálogos

Vault permite buscar, etiquetar, marcar favoritos, guardar sonidos e importar/exportar bancos JSON. El catálogo incluido añade recetas de melodía y sonidos nativos, entre ellos Scarlett Protocol / Scarlett Razor. Una receta prepara el generador; un sonido puede usarse sin cargar IA.

Puedes importar catálogos JSON desde disco o URL HTTPS con CORS: hasta **1 MB y 256 entradas**. El catálogo importado dura la sesión; guarda explícitamente sus sonidos en Vault para conservarlos. Las recetas personales de IA tienen su propia biblioteca.

Los patches de **Vital, Surge XT y Serum** necesitan sus propios sintetizadores; los enlaces externos del catálogo no son conversores ni licencias para redistribuirlos. La colección incluida funciona sin acceso al repositorio privado.

## Muestras de batería y sampler

Los siete **Impact Sample Slots** permiten trim, afinación, attack/release, reverse, detección de transitorios y reparto de slices entre pads libres. Sus muestras participan en reproducción y WAV offline. Para tocar una muestra cromáticamente, usa [Prism Keys](Arreglo-y-audio.md).

Los blobs se guardan en IndexedDB y viajan en Project Package. La exportación MIDI conserva notas, no el patch del sintetizador.

Detalles del formato: [catálogo técnico](../PRESET_CATALOG.md). Los buses FX instrumentales en directo se comparten por pista: una nueva configuración puede colorear colas anteriores.
