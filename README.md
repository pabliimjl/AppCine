# AppCine

Aplicación web desarrollada como trabajo práctico de la asignatura **Programación IV**, correspondiente a la **Tecnicatura Universitaria en Programación** de la **Universidad Tecnológica Nacional, Facultad Regional Avellaneda**.

El proyecto modela el flujo de una plataforma de cine: consulta de cartelera y funciones, selección de entradas y butacas, compra de productos de Candy Bar y administración de las operaciones del establecimiento. Su propósito es académico y permite aplicar contenidos de desarrollo frontend, persistencia, autenticación, autorización e integración con servicios externos.

## Funcionalidades

- Consulta de películas, géneros, sinopsis, calificaciones y horarios disponibles.
- Selección de entradas por categoría y elección de butacas.
- Compra de productos y combos de Candy Bar junto con las entradas.
- Inicio de sesión, registro y perfil con historial de compras, créditos y puntos.
- Gestión de datos del perfil con confirmación de contraseña y cambio de contraseña.
- Emisión y validación de entradas mediante códigos QR; descarga del ticket en PDF.
- Panel de administración para gestionar películas, funciones, productos, combos, cupones y descuentos.
- Registro de auditoría con fecha, hora, usuario y tipo de operación para cambios y transacciones relevantes.
- Métricas de facturación, entradas vendidas y rankings, con exportación de reportes a PDF y Excel.
- Interfaz instalable como aplicación web progresiva (PWA).

## Tecnologías

- **Angular 22** para la aplicación cliente, con componentes independientes, rutas, formularios reactivos y signals.
- **TypeScript 6** para la lógica y el tipado estático.
- **SCSS** para los estilos de la interfaz.
- **Supabase** para autenticación, base de datos PostgreSQL y funciones RPC.
- **ZXing** y `angularx-qrcode` para lectura y generación de códigos QR.
- **jsPDF** para la generación de tickets e informes PDF.
- **SheetJS (`xlsx`)** para exportar informes en formato Excel `.xlsx`.
- **Firebase Hosting** como destino de publicación configurado.

## Requisitos

- Node.js compatible con Angular 22.
- npm. La versión declarada por el proyecto es `11.12.1`.
- Una instancia de Supabase configurada para la aplicación.

## Instalación

1. Clonar el repositorio y entrar en el directorio del proyecto:

   ```bash
   git clone <URL-del-repositorio>
   cd app-cine
   ```

2. Instalar las dependencias:

   ```bash
   npm install
   ```

3. Configurar la URL y la clave pública de Supabase en:

   - `src/environments/environment.development.ts` para desarrollo.
   - `src/environments/environment.ts` para la compilación de producción.

   La configuración utiliza las propiedades `supabaseUrl` y `supabaseKey`. Cada archivo debe contener las credenciales correspondientes al proyecto de Supabase que se utilizará.

4. Para una instancia nueva, abrir el **SQL Editor** de Supabase y ejecutar el contenido de `supabase.sql`. El archivo crea las tablas, índices, funciones RPC, políticas RLS, triggers y bucket de imágenes requeridos por la aplicación.

5. Iniciar el servidor local:

   ```bash
   npm start
   ```

   Angular mostrará la dirección local disponible, normalmente `http://localhost:4200`.

## Uso

### Flujo de usuario

1. Explorar la cartelera y seleccionar una película y una función.
2. Elegir cantidades y categorías de entradas, y seleccionar las butacas.
3. Agregar productos o combos del Candy Bar y completar el pago con los medios disponibles.
4. Consultar el ticket y su código QR. Para asociar compras e historial a una cuenta, iniciar sesión antes de comprar.
5. Desde **Mi Perfil**, consultar compras, créditos, puntos y películas; editar datos requiere confirmar la contraseña actual.

### Flujo de administración

El acceso a `/admin` requiere una cuenta cuyo perfil tenga el rol `admin` en Supabase. Desde el panel se pueden gestionar películas, funciones, Candy Bar, cupones y descuentos, consultar métricas y exportar reportes. El botón **Gestionar log** abre la auditoría en `/admin/log`, donde se elige el periodo en días (de 1 a 3650, con 30 días por defecto). La sección **Validar QR** permite verificar entradas desde el dispositivo administrador.

El **Registro de auditoría** muestra las operaciones ocurridas dentro del periodo seleccionado, con fecha y hora, usuario, acción, entidad afectada y una referencia descriptiva. Los resultados se consultan en páginas de 100 registros hasta completar el periodo, sin un límite total de 100 operaciones. Los triggers de PostgreSQL registran altas, modificaciones y eliminaciones en entidades de administración, perfiles, reseñas, compras, reservas de butacas y Candy Bar, además de movimientos de créditos y puntos. El log no conserva contraseñas ni copias completas de las filas. La política RLS permite consultarlo únicamente a perfiles con rol `admin`.

## Comandos disponibles

| Comando         | Descripción                                                         |
| --------------- | ------------------------------------------------------------------- |
| `npm start`     | Inicia el servidor de desarrollo de Angular.                        |
| `npm run build` | Genera la compilación de producción.                                |
| `npm run watch` | Compila en modo desarrollo y vuelve a compilar al detectar cambios. |
| `npm test`      | Ejecuta las pruebas configuradas en el proyecto.                    |

La compilación de producción se genera en `dist/app-cine/browser`, directorio configurado para Firebase Hosting. La publicación requiere configurar y autenticar el proyecto de Firebase correspondiente.

## Configuración y seguridad

- Las claves incluidas en el cliente deben ser claves públicas de Supabase (`anon` o publishable). **No** incluir una clave `service_role` en la aplicación frontend.
- La autorización de acceso a datos debe mantenerse en las políticas de seguridad a nivel de fila (RLS) y en las funciones RPC de Supabase; ocultar una opción de la interfaz no sustituye la autorización del servidor.
- Para un entorno propio, reemplazar las credenciales de ejemplo por las del proyecto correspondiente y mantener separadas las configuraciones de desarrollo y producción.
- La función de envío de correo del ticket se encuentra en `supabase/functions/send-ticket-email` y requiere la configuración de secretos del servicio de correo en Supabase para operar.

## Alcance académico

La aplicación se presenta como material de práctica y demostración de conceptos de Programación IV. Antes de utilizarla en un entorno real se deben revisar la seguridad, las políticas de acceso, los datos personales, los medios de pago, el envío de correo y los procesos de despliegue.
