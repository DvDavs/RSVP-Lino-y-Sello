package mx.evolutiondev.invitaciones.core.util.formatter

fun Int?.valueOrZero(): Int {
    return this ?: 0
}