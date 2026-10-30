# IA local: melodías editables

[English](Local-AI.md) | [Español](ES-Local-AI.md)

![Comparación A/B/C y regeneración por compases](assets/ai-composer.png)

*Captura real de la interfaz con un fixture de pruebas. Las notas visibles no se presentan como evidencia de inferencia del modelo.*

## Generar y comparar

1. Selecciona una pista melódica y abre **AI melody** desde Compose, Project, Settings o la paleta de comandos.
2. Elige **New idea, Continue, Answer, Vary** o **Same motif, new rhythm**. Los modos de fuente requieren un clip con notas.
3. Configura tonalidad, escala, 1–8 compases, estilo, ritmo y BPM de preview. **Fit the active clips** aporta contexto armónico de los clips activos.
4. Carga explícitamente un modelo y genera. En modo rápido, una inferencia propone un plan y el motor crea hasta tres alternativas. **Quality mode** hace tres inferencias secuenciales y las ordena/deduplica localmente.
5. Compara A/B/C en loop, ajusta la propuesta o regenera compases seleccionados. **Add as new clip** conserva el original y admite Undo/Redo.

## Control musical

Phrase/Loop/Free, densidad automática o 2/4/8/12 ataques por compás, registro, salto máximo de 2/5/7/12 semitonos y repetición/variación. El compilador respeta escalas y límites; un ajuste restrictivo puede producir menos alternativas distintas.

El contexto se limita a 512 notas por clip melódico activo; no analiza audio ni todo el arreglo. Cambiar el shaping reutiliza el plan sin otra inferencia. Regeneración parcial conserva las notas de los compases no seleccionados; si no puede conectar los límites, mantiene la propuesta anterior.

**Apply this BPM** es la única opción que cambia el tempo base al insertar; los eventos posteriores del mapa permanecen. Cancelar o fallar conserva el resultado anterior.

## Recetas y motores

**My recipes** guarda hasta 100 recetas locales: nombre, prompt, estilo/ritmo, parámetros y sonido compatible opcional. Permite búsqueda, favoritos, rename, delete y Undo delete. No guarda las notas fuente; no tiene sincronización ni import/export de la biblioteca.

**Automatic** prueba GPU en página y worker y usa CPU si falla. GPU: Qwen3 0.6B; CPU compatible: SmolLM2 135M q8. La descarga es explícita y cada motor tiene su caché. Cancel, Free memory y Delete downloads gestionan trabajo/memoria/modelos.

Los modelos pequeños pueden interpretar mal peticiones complejas. Calidad es una selección heurística, no una preferencia musical demostrada. Son notas editables, no audio grabado. [Compatibilidad y offline](ES-Compatibility-and-licenses.md) · [Detalles de implementación](../LOCAL_AI.md).
