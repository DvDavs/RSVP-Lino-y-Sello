package mx.evolutiondev.invitaciones.core.auth.security

import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import mx.evolutiondev.invitaciones.core.auth.jwt.JwtUtil
import mx.evolutiondev.invitaciones.core.auth.ktx.isCustomerAvailable
import mx.evolutiondev.invitaciones.core.auth.model.CustomerDetails
import mx.evolutiondev.invitaciones.core.auth.repository.CustomerRepository
import mx.evolutiondev.invitaciones.core.error.model.ErrorMessage
import mx.evolutiondev.invitaciones.core.util.formatter.DateFormatter
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter

@Component
class JwtTokenFilter(
        private val customerRepository: CustomerRepository,
        private val jwtUtil: JwtUtil,
        private val dateFormatter: DateFormatter
) : OncePerRequestFilter() {

    private val appLogger: Logger = LoggerFactory.getLogger(JwtTokenFilter::class.java)

    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, chain: FilterChain) {
        // R4-01. Aqui se registraba el objeto `request` entero. Hoy no filtra nada porque el
        // `HeaderWriterRequest` que llega hereda el `toString()` de `Object` (clase y hash), pero es
        // munición cargada: el dia que un envoltorio de la cadena de filtros traiga un `toString()`
        // propio, esta linea empieza a volcar cabeceras -la `Authorization` incluida- en cada
        // peticion. Se registra lo unico que hacia falta: el metodo y la ruta, sin cadena de consulta.
        appLogger.info("authenticated urls: {} {}", request.method, request.requestURI)

        val path = request.requestURI
        if (path == "/webhook") {
            chain.doFilter(request, response)
            return
        }

        val header = request.getHeader("Authorization")
        if (header != null && header.startsWith("Bearer ")) {
            val token = header.substring(7)
            if (!jwtUtil.isValidToken(token)) {
                sendErrorResponse(response, HttpServletResponse.SC_UNAUTHORIZED, "El token proporcionado no es válido")
                return
            }
            jwtUtil.getUserIdFromToken(token)?.let { customerId ->
                val longCustomerId = customerId.toLong()
                val customer = customerRepository.findByIdEvenIfDisabled(longCustomerId)
                if (customer == null) {
                    sendErrorResponse(response, HttpServletResponse.SC_UNAUTHORIZED, "El token proporcionado no es válido")
                    return
                }
                if (!customer.isEnabled) {
                    sendErrorResponse(response, HttpServletResponse.SC_UNAUTHORIZED, "El usuario asociado al token no existe")
                    return
                }
                if (customer.isBanned) {
                    sendBannedUserErrorResponse(response, "Su cuenta ha sido bloqueada. Contacte al administrador.")
                    return
                }
                appLogger.info("Customer role from DB: ${customer.role}, id: ${customer.id}")
                val authorities = listOf(SimpleGrantedAuthority("ROLE_${customer.role}"))
                val authentication = UsernamePasswordAuthenticationToken(
                        CustomerDetails(longCustomerId, customer.email, "", authorities),
                        null,
                        authorities
                )
                authentication.details = WebAuthenticationDetailsSource().buildDetails(request)
                SecurityContextHolder.getContext().authentication = authentication
            } ?: run {
                sendErrorResponse(response, HttpServletResponse.SC_UNAUTHORIZED, "El token proporcionado no es válido")
                return
            }
        }
        chain.doFilter(request, response)
    }

    private fun sendErrorResponse(response: HttpServletResponse, status: Int, message: String) {
        response.contentType = "application/json"
        response.status = status
        val errorMessages = ErrorMessage(
                timestamp = dateFormatter.parseCurrentDate("dd/MM/yyyy HH:mm:ss"),
                statusCode = status,
                errors = mutableMapOf(
                        "url" to message
                )
        )
        val mapper = ObjectMapper()
        mapper.writeValue(response.outputStream, errorMessages)
    }

    private fun sendBannedUserErrorResponse(response: HttpServletResponse, message: String) {
        response.contentType = "application/json"
        response.status = HttpServletResponse.SC_FORBIDDEN
        val errorMessages = ErrorMessage(
                timestamp = dateFormatter.parseCurrentDate("dd/MM/yyyy HH:mm:ss"),
                statusCode = HttpServletResponse.SC_FORBIDDEN,
                errors = mutableMapOf(
                        "error" to message,
                        "type" to "USER_BANNED"
                )
        )
        val mapper = ObjectMapper()
        mapper.writeValue(response.outputStream, errorMessages)
    }
}