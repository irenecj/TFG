# TRABAJO FIN DE GRADO - ¡PEQUEÑOS HÉROES! OPERACIÓN: SALVAR EL PLANETA.

## :clipboard: DESCRIPCIÓN
El proyecto ha consistido en crear un juego de tablero, apoyado en un sistema de cartas e integrado con un asistente virtual, y con finalidad educativa. Para llevarlo a cabo se ha creado una **aplicación móvil** con dos lectores, uno para NFC y otro para códigos QR, y una **skill de Alexa**.

### :file_folder: ESTRUCTURA DE LA SKILL DE ALEXA
Para poder hacer uso de la skill simplemente habrá que dirigirse a **Alexa Developer Console** y ahí indicar que queremos importar una skill.

- **NombreSkill:** este directorio tiene que tener el nombre de nuestra skill, por ejemplo, amzn1. ask.skill.35145b0f-1789-4cad-a69b-f3a569f50f08.
  - **assets/images:** aquí alojamos todas las imágenes que usaremos en el proyecto, en este caso sólo tenemos los dos iconos de nuestra skill.
  - **interactionModels/custom:** en este directorio tenemos un fichero JSON que contiene el modelo de interacción de la skill. En él podemos encontrar todos los intents que hemos declarado junto con las utterances que tienen asignadas. De esta forma tenemos representadas todas las posibles interacciones que pueden tener lugar desde el lado del usuario.
  - **lambda:** este directorio contiene el resto de ficheros que hemos utilizado para desarrollar la skill. 
    - **index.js:** en este fichero tenemos la implementación de todos los intents creados.
    - **dynamo.js:** contiene las funciones necesarias para realizar las operaciones con la base de datos.
		- **language-strings.js:** en él hemos añadido todos los mensajes que reproduce Alexa a lo largo de la 						partida. Este fichero permite tener varias traducciones del mismo mensaje en diferentes idiomas y usar las 							correspondientes en función del idioma en el que tengamos el dispositivo donde estamos utilizando la skill.
		- **package.json** tiene las dependencias utilizadas en el código.
  - **skill.json:** fichero JSON que tiene toda la información sobre nuestra skill, como su nombre, los locales, la frase para invocar a la skill, la descripción, el endpoint, entre otros datos.
      
	En cuanto a la base de datos, como la utilizada ha sido **DynamoDB** y la tenemos alojada en AWS, siempre podremos acceder a ella sin ningún problema.
	
### :iphone: ESTRUCTURA DE LA APLICACIÓN MÓVIL
A continuación, vamos a ver la estructura de nuestro proyecto de Android Studio.
  
El proyecto, llamado **savePlanet** está formado, entre otros, por el módulo **app**, el cual a su vez se compone de diferentes directorios y ficheros:
- **/app/build:** contiene los resultados de la compilación.
		  - **Fichero /outputs/debug/app-debug.apk:** es el fichero APK para poder instalar nuestra aplicación.
- **/app/src/main/java:** este directorio contiene todo el código fuente de la aplicación. Android Studio creo por defecto el código de la pantalla principal, cuyo fichero se llama **MainActivity.java**. En nuestro proyecto, en esta carpeta tenemos también los ficheros correspondientes a las actividades de ambos lectores, que son **MainActivityQR.java** y **MainActivityNFC.java**.
- **/app/src/main/res:** contiene los ficheros de recursos que necesitamos para el proyecto, como imágenes o layouts.
  - **/res/drawable:** aquí se ubican las imágenes y otros elementos gráficos, en nuestro caso tenemos las imágenes de las diferentes caras del dado.
	- **/res/layout:** en él nos encontramos los ficheros de definición XML de las diferentes pantallas que forman nuestra interfaz gráfica.
	- **/res/values:** formado por otros ficheros XML de recursos como cadenas de texto, estilos, un listado de colores, entre otros.
- **Fichero /app/src/main/AndroidManifest.xml:** contiene la definición en XML de los aspectos principales de nuestra aplicación, como su nombre, icono, las pantallas, los permisos necesarios para ejecutar la aplicación y varios datos más.
- **Fichero /app/build.gradle:** en él se refleja la información necesaria para la compilaci´n del proyecto, como la versión del SDK de Android, la versión de Android que soportará o referencias a las librerías externas utilizadas.
