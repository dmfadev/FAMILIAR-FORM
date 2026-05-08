# 📋 Sistema de Fiscalización · Banco Familiar

Formulario web de relevamiento de locales comerciales, construido sobre **Google Apps Script** con almacenamiento en **Google Sheets** y **Google Drive**.

---

## 🗂️ Estructura del repositorio

## ⚙️ Tecnologías

- Google Apps Script (backend)
- Google Sheets (base de datos)
- Google Drive (almacenamiento de fotos)
- HTML / CSS / JavaScript vanilla (frontend)

## 📌 Funcionalidades

- Buscador dinámico de locales con coincidencia parcial
- Selección controlada en todos los campos (sin texto libre)
- Lógica condicional: materiales Tipo A / Tipo B
- Módulo de fotos con mínimo 2 y máximo 6 imágenes
- Redimensionado automático a 1920px en el cliente (Canvas API)
- Fotos guardadas en Google Drive con nombre estructurado
- Registro automático en hoja RESPUESTAS con fórmulas `=IMAGE()`

## 🗃️ Planilla Google Sheets

| Hoja | Función |
|------|---------|
| `SUCURSALES` | Lista de locales (Tienda + Shopping) |
| `RESPUESTAS` | Se crea automáticamente al primer envío |

## 🚀 Despliegue

Ver sección de configuración en Apps Script.

## 👤 di

**dmfadev** · [github.com/dmfadev](https://github.com/dmfadev)
