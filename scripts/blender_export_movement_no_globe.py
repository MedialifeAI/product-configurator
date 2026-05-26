# Run inside Blender via MCP execute_blender_code (read file and exec)
# Re-exports movement variants without the separate "globe" object (configurator loads globe GLB on top).

import bpy
import os

EXPORT_ROOT = r"C:\Users\devel\OneDrive\Documents\Medialife\Projects\Jacob & Co\Watch parts"
EXCLUDE = {"globe"}

def is_under_globe(obj):
    p = obj
    while p:
        if p.name in EXCLUDE:
            return True
        p = p.parent
    return False

def collect_movement_objects():
    objs = []
    for col_name in ("WATCH_MOVEMENT_ANIMATED", "WATCH_MOVEMENT_STATIC"):
        col = bpy.data.collections.get(col_name)
        if not col:
            continue
        for obj in col.all_objects:
            if not is_under_globe(obj):
                objs.append(obj)
    return objs

def export_movement(filepath):
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    objs = collect_movement_objects()
    for o in objs:
        o.select_set(True)
    if not objs:
        return "no objects"
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(
        filepath=filepath,
        export_format="GLB",
        use_selection=True,
        export_apply=False,
        export_yup=True,
        export_materials="EXPORT",
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_skins=True,
        export_force_sampling=True,
        export_frame_range=True,
    )
    return f"OK {filepath} {os.path.getsize(filepath) // 1024} KB ({len(objs)} objs)"

for metal in ("rose_gold", "white_gold", "yellow_gold"):
    path = os.path.join(EXPORT_ROOT, "movement", "variants", f"movement_{metal}.glb")
    print(export_movement(path))
