package mx.evolutiondev.invitaciones.core.config

import org.springframework.boot.SpringApplication
import org.springframework.boot.env.EnvironmentPostProcessor
import org.springframework.core.Ordered
import org.springframework.core.env.ConfigurableEnvironment
import org.springframework.util.ClassUtils

/**
 * Compuerta de arranque de los secretos de `application.yml` (fase 5, bloque E3-A3; ADR-5-E3-A3-01,
 * hallazgo S-01 de `diseno/12-producto-completo.md A3`).
 *
 * Los cuatro secretos que estaban escritos en claro en `application.yml` (clave de firma del JWT,
 * credenciales de AWS, cuenta y contrasena del buzon transaccional) pasaron a `${VAR}` **sin valor
 * por defecto**: si la variable no esta, la aplicacion no debe arrancar. Ese comportamiento ya lo da
 * Spring solo, pero con un mensaje que no ayuda a nadie:
 *
 *     Could not resolve placeholder 'JWT_SECRET' in value "${JWT_SECRET}"
 *
 * ...que ademas aparece cuando se crea el primer bean que lee la propiedad, mezclado con una traza de
 * inyeccion de dependencias. Esta clase corre **antes que cualquier bean** (es un
 * `EnvironmentPostProcessor`, no un componente del contexto) y falla con un mensaje que dice **que
 * variables faltan, para que sirve cada una y como ponerlas**.
 *
 * Lo que esta clase NO hace, a proposito:
 *  - no inventa valores de reserva: un valor por defecto en claro es exactamente el defecto que este
 *    bloque vino a quitar;
 *  - no genera la clave del JWT al vuelo: una clave distinta por instancia y por reinicio invalida
 *    en silencio todas las sesiones vivas, y un fallo silencioso en produccion es peor que un
 *    arranque que se niega y explica por que.
 *
 * LO QUE ESTA LISTA NO TIENE, Y ES DELIBERADO (fase 5, E3-C3; ADR-5-E3-C3-01): los dos secretos de
 * WhatsApp (`WHATSAPP_ACCESS_TOKEN` y `WHATSAPP_WEBHOOK_VERIFY_TOKEN`). Salieron del repositorio en
 * el mismo bloque, pero **no impiden el arranque**. Los cinco de aqui son de sistemas sin los cuales
 * el producto no existe (firma de sesion, bucket de assets, correo transaccional); WhatsApp hoy es
 * solo click-to-chat (`decisiones-dueno.md` D-04) y exigir su token romperia todo despliegue que no
 * lo usa, empujando al operador a inventarse un valor —el defecto que este bloque vino a quitar—.
 * En su lugar el modulo se apaga solo y sus rutas responden `503`
 * (`modules/shared/whatsapp/WhatsAppConfiguracion.kt`).
 *
 * No se registra por `@Component`: los `EnvironmentPostProcessor` se declaran en
 * `META-INF/spring.factories`, que es la UNICA via que Spring Boot 3.4 admite para ellos
 * (`SpringFactoriesEnvironmentPostProcessorsFactory`); con el fichero `.imports` de las
 * autoconfiguraciones la clase ni se carga (verificado: el arranque siguio adelante). Al no ser un
 * bean, no participa en el escaneo de componentes ni afecta a los contextos acotados de las pruebas
 * (`ApplicationContextRunner` no ejecuta `EnvironmentPostProcessor`).
 */
class SecretosObligatorios : EnvironmentPostProcessor, Ordered {

    private data class Exigida(val nombre: String, val paraQue: String)

    private val exigidas = listOf(
        Exigida(
            "JWT_SECRET",
            "clave de firma de los tokens de sesion (minimo 32 caracteres; HS256 en JwtUtil.kt). " +
                "Cambiarla cierra la sesion de todo el mundo: no la cambies sin querer hacerlo.",
        ),
        Exigida(
            "AWS_ACCESS_KEY_ID",
            "identificador de la credencial de AWS con la que se leen y escriben los buckets.",
        ),
        Exigida(
            "AWS_SECRET_ACCESS_KEY",
            "secreto de esa credencial de AWS.",
        ),
        Exigida(
            "MAIL_USERNAME",
            "cuenta del buzon desde el que sale el correo transaccional.",
        ),
        Exigida(
            "MAIL_PASSWORD",
            "contrasena de aplicacion de ese buzon.",
        ),
    )

    override fun postProcessEnvironment(environment: ConfigurableEnvironment, application: SpringApplication) {
        if (!debeExigir(environment)) return
        val faltan = exigidas.filter { environment.getProperty(it.nombre).isNullOrBlank() }
        if (faltan.isEmpty()) return
        throw IllegalStateException(mensaje(faltan))
    }

    /**
     * Decide si la compuerta corre. El orden importa y el primero que gana es **el explicito**.
     *
     * R1-13 de la revision adversarial (`bitacora/5-E3-R1-seguridad.md`) objeta —con razon— que
     * decidir esto por la **presencia de una clase** ([enPruebas]) es fragil: es una condicion que
     * el operador no controla. Objeta tambien, y lo verifico, que hoy **no es explotable** (sin
     * `JWT_SECRET` Spring falla igual al resolver el placeholder), asi que la severidad es BAJA.
     *
     * Arreglo (ADR-5-E3-C3-01): se anade `$PROPIEDAD_EXIGIR`, que **manda sobre todo lo demas**.
     *  - `true`  -> la compuerta corre SIEMPRE, este o no `spring-boot-test` en el classpath. Es la
     *               pieza que faltaba: un despliegue puede exigir la comprobacion por si mismo, sin
     *               depender de que nadie haya metido una dependencia de pruebas en el empaquetado.
     *  - `false` -> la compuerta no corre. Para un arranque acotado que declara sus propiedades.
     *  - ausente -> se cae a la heuristica de siempre.
     *
     * La heuristica **se conserva** como valor por defecto, y no por descuido: sustituirla por un
     * perfil o una propiedad obligaria a declararla en cada contexto de prueba que arranca por
     * `SpringApplication`, que es exactamente lo que tumbo 216 pruebas cuando esta compuerta se
     * escribio (ver [enPruebas]). Cambiar el defecto es una mejora de robustez de severidad BAJA y
     * no vale romper la suite por ella; lo que si hacia falta —darle al
     * operador un control explicito— esta hecho.
     */
    private fun debeExigir(environment: ConfigurableEnvironment): Boolean {
        val explicito = environment.getProperty(PROPIEDAD_EXIGIR)?.trim()?.lowercase()
        return when (explicito) {
            "true" -> true
            "false" -> false
            else -> !enPruebas()
        }
    }

    /**
     * Las pruebas de contexto (`@DataJpaTest`, `@SpringBootTest`) arrancan por `SpringApplication`, asi
     * que **si** ejecutan los `EnvironmentPostProcessor`: sin esta salida, esta compuerta tumbaba 216
     * pruebas (medido). La alternativa —escribir valores en `src/test/resources`— es peor: mete
     * cadenas con pinta de credencial en el repositorio, que es justo lo que este bloque vino a quitar,
     * y ademas taparia el fallo en desarrollo.
     *
     * `spring-boot-test` entra por `testImplementation`, asi que **no** esta en el classpath de
     * ejecucion: si la clase aparece, estamos en pruebas. Lo que las pruebas exigen de estas
     * propiedades lo declaran ellas mismas (`@DynamicPropertySource`, `properties = [...]`), como ya
     * hacen con la base de datos; ninguna necesita un secreto de verdad.
     */
    private fun enPruebas(): Boolean = ClassUtils.isPresent(
        "org.springframework.boot.test.context.SpringBootTestContextBootstrapper",
        javaClass.classLoader,
    )

    private fun mensaje(faltan: List<Exigida>): String {
        val lista = faltan.joinToString("\n") { "  - ${it.nombre}: ${it.paraQue}" }
        val exports = faltan.joinToString("\n") { "  export ${it.nombre}=..." }
        return """
            |
            |*************************************************************************************
            |LA APLICACION NO ARRANCA: FALTAN VARIABLES DE ENTORNO CON SECRETOS
            |*************************************************************************************
            |
            |Falta ${faltan.size} de ${exigidas.size}:
            |
            |$lista
            |
            |Como ponerlas (una linea por variable, antes de arrancar):
            |
            |$exports
            |
            |DESARROLLO LOCAL: no las escribas a mano. `scripts/dev-backend.sh start` ya define las
            |cinco con valores de desarrollo evidentemente falsos y arranca contra el Postgres
            |efimero. Ese script es el unico sitio donde puede haber valores escritos.
            |
            |POR QUE NO HAY VALOR POR DEFECTO (ADR-5-E3-A3-01, hallazgo S-01): estos secretos estaban
            |escritos en claro en `src/main/resources/application.yml`. Un valor por defecto aqui es
            |el mismo agujero con otra forma, y una clave de JWT generada al vuelo invalidaria todas
            |las sesiones vivas en cada reinicio, en silencio. No inventes un valor: pide el que toca
            |al entorno de despliegue.
            |*************************************************************************************
            |
        """.trimMargin()
    }

    // Ultimo: para entonces `systemEnvironment` y `systemProperties` ya estan en el entorno y los
    // ficheros de configuracion tambien, asi que vale cualquier via de las que Spring admite.
    override fun getOrder(): Int = Ordered.LOWEST_PRECEDENCE

    companion object {
        /**
         * Interruptor explicito de la compuerta (ADR-5-E3-C3-01, R1-13). Como variable de entorno:
         * `SECRETOS_OBLIGATORIOS_EXIGIR=true`. Como propiedad de la JVM:
         * `-Dsecretos.obligatorios.exigir=false`. Ausente = heuristica de siempre.
         */
        const val PROPIEDAD_EXIGIR: String = "secretos.obligatorios.exigir"
    }
}
