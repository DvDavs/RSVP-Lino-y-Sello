package mx.evolutiondev.invitaciones.modules.templates2.persistence

import mx.evolutiondev.invitaciones.core.s3.S3Buckets
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component

/**
 * Único punto del módulo que decide **en qué bucket de S3 escribe `templates2`**.
 *
 * Existe por dos motivos, los dos con historia:
 *
 * 1. **La objeción ADV-01 de la revisión adversarial de cierre.** Cuatro puntos del módulo resolvían
 *    el bucket por su cuenta y con valores distintos, así que el editor subía a uno y el catálogo
 *    componía la URL desde otro. Ninguna de las 1 100 pruebas lo veía, porque todas inyectan un
 *    bucket de prueba. Con esta clase hay **una sola** respuesta para todo el módulo.
 *
 * 2. **No escribir jamás en el bucket de producción por omisión.** La corrección de ADV-01 unificó el
 *    valor, pero lo unificó en [S3Buckets.ASSETS] —`invitacionesdigitalesassets`, que es el bucket
 *    **de producción**—, de modo que arrancar sin configurar nada bastaba para empezar a subir
 *    objetos de cliente ahí. Un bucket de producción no puede ser el valor por defecto de nada:
 *    el defecto se aplica justo cuando alguien **no** ha pensado en el asunto.
 *
 * Por eso `templates2.assets.bucket` es **obligatoria y sin defecto**: si falta, la aplicación **no
 * arranca** y dice exactamente qué hacer. Es deliberadamente ruidoso. La alternativa —caer en un
 * nombre inventado— convertiría el error en un `404 NoSuchBucket` por cada subida, en tiempo de
 * ejecución y sin explicación.
 *
 * Además se rechaza explícitamente el bucket de producción salvo que se declare la intención con
 * `templates2.assets.allow-production-bucket=true`, para que un `.env` copiado de producción a un
 * entorno de pruebas no pase inadvertido.
 */
@Component
class Templates2AssetBucket(
    @Value("\${templates2.assets.bucket:}") configurado: String,
    @Value("\${templates2.assets.allow-production-bucket:false}") permitirProduccion: Boolean,
) {

    val nombre: String = resolver(configurado.trim(), permitirProduccion)

    private fun resolver(configurado: String, permitirProduccion: Boolean): String {
        if (configurado.isBlank()) {
            throw Templates2AssetBucketNoConfigurado(
                "Falta la propiedad obligatoria 'templates2.assets.bucket'. El módulo templates2 no " +
                    "tiene bucket por defecto a propósito: el único candidato natural sería " +
                    "'${S3Buckets.ASSETS}', que es el bucket de PRODUCCIÓN, y arrancar sin pensarlo " +
                    "subiría objetos de cliente ahí. Define un bucket de pruebas, por ejemplo " +
                    "TEMPLATES2_ASSETS_BUCKET=mi-bucket-de-pruebas.",
            )
        }
        if (configurado == S3Buckets.ASSETS && !permitirProduccion) {
            throw Templates2AssetBucketNoConfigurado(
                "'templates2.assets.bucket' apunta al bucket de PRODUCCIÓN ('${S3Buckets.ASSETS}'). " +
                    "Si es intencionado, declara también " +
                    "'templates2.assets.allow-production-bucket=true'. Si no lo es —el caso " +
                    "habitual: un fichero de configuración copiado de producción— cámbialo por un " +
                    "bucket de pruebas.",
            )
        }
        return configurado
    }
}

/**
 * Se lanza al construir el contexto, no al servir una petición: es un error de configuración, y el
 * sitio correcto para descubrirlo es el arranque. No hereda de `Templates2Exception` porque no es un
 * error de una ruta y no le corresponde ningún código `TPL_*` de `03 §5`.
 */
class Templates2AssetBucketNoConfigurado(mensaje: String) : IllegalStateException(mensaje)
