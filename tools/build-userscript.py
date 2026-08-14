#!/usr/bin/env python3
"""Genera 'NoMi Asistente V5.8.user.js' a partir de build/ y modules/.

Modo normal:
    python3 tools/build-userscript.py
    Escribe el userscript empaquetado (header -> módulos ordenados -> bootstrap),
    sin @require, en UTF-8.

Modo comprobación:
    python3 tools/build-userscript.py --check
    Falla (exit != 0) si el archivo generado no está actualizado respecto a las
    fuentes (build/ + modules/ + VERSION_SCRIPT).

Sin dependencias externas. Solo biblioteca estándar.
"""

import os
import re
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)

HEADER_PATH = os.path.join(REPO, "build", "userscript-header.js")
BOOTSTRAP_PATH = os.path.join(REPO, "build", "userscript-bootstrap.js")
ORDER_PATH = os.path.join(REPO, "build", "modules-order.txt")
CONFIG_PATH = os.path.join(REPO, "modules", "nomi-config-estatica.js")
OUTPUT_PATH = os.path.join(REPO, "NoMi Asistente V5.8.user.js")
MODULES_DIR = os.path.join(REPO, "modules")

VERSION_MARKER = "__NOMI_VERSION__"


def die(msg):
    sys.stderr.write("ERROR: " + msg + "\n")
    sys.exit(1)


def read_text(path):
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return fh.read()
    except FileNotFoundError:
        die("no se encontro el archivo: " + path)
    except OSError as exc:
        die("no se pudo leer %s: %s" % (path, exc))


def get_version():
    text = read_text(CONFIG_PATH)
    match = re.search(r"VERSION_SCRIPT\s*=\s*['\"]([^'\"]+)['\"]", text)
    if not match:
        die("no se encontro VERSION_SCRIPT en " + CONFIG_PATH)
    return match.group(1)


def read_module_order():
    text = read_text(ORDER_PATH)
    names = [line.strip() for line in text.splitlines() if line.strip()]
    if not names:
        die("la lista de modulos esta vacia: " + ORDER_PATH)
    seen = set()
    for name in names:
        if name in seen:
            die("modulo duplicado en %s: %s" % (ORDER_PATH, name))
        seen.add(name)
    return names


def reject_require(text, label):
    if re.search(r"^\s*//\s*@require\b", text, re.MULTILINE):
        die("se encontro una linea @require en %s; el bundle no debe usar @require" % label)


def build_userscript():
    version = get_version()

    header = read_text(HEADER_PATH)
    reject_require(header, "la cabecera (build/userscript-header.js)")
    if header.count(VERSION_MARKER) != 1:
        die("se requiere exactamente un marcador %s en la cabecera: %s" % (VERSION_MARKER, HEADER_PATH))
    header = header.replace(VERSION_MARKER, version)

    names = read_module_order()
    parts = [header.rstrip("\n")]
    for name in names:
        mod_path = os.path.join(MODULES_DIR, name)
        if not os.path.isfile(mod_path):
            die("modulo no encontrado: " + mod_path)
        content = read_text(mod_path).rstrip("\n")
        parts.append("")
        parts.append("// ======== MODULO: %s (bundle) ========" % name)
        parts.append(content)

    bootstrap = read_text(BOOTSTRAP_PATH).rstrip("\n")
    if not bootstrap.strip():
        die("el bootstrap esta vacio: " + BOOTSTRAP_PATH)
    parts.append("")
    parts.append("// ======== BOOTSTRAP (bundle) ========")
    parts.append(bootstrap)

    generated = "\n".join(parts) + "\n"
    reject_require(generated, "la salida generada")
    return generated


def main():
    check_mode = "--check" in sys.argv[1:]
    generated = build_userscript()

    if check_mode:
        if not os.path.isfile(OUTPUT_PATH):
            die("--check: el archivo generado no existe: " + OUTPUT_PATH)
        current = read_text(OUTPUT_PATH)
        if current != generated:
            die("--check: el archivo generado NO esta actualizado: " + OUTPUT_PATH)
        sys.stderr.write("OK: el archivo generado esta actualizado.\n")
    else:
        out_dir = os.path.dirname(OUTPUT_PATH)
        fd, tmp_path = tempfile.mkstemp(dir=out_dir, prefix=".nomi-build-", suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8", newline="") as fh:
                fh.write(generated)
                fh.flush()
                os.fsync(fh.fileno())
            os.replace(tmp_path, OUTPUT_PATH)
            sys.stderr.write("Generado: %s\n" % OUTPUT_PATH)
        except Exception:
            try:
                os.remove(tmp_path)
            except OSError:
                pass
            die("fallo al escribir el bundle: " + OUTPUT_PATH)

    sys.exit(0)


if __name__ == "__main__":
    main()
