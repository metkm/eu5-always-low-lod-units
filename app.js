import { readFileSync, writeFileSync } from "node:fs";
import { readdir, rm } from "node:fs/promises";
import { Jomini } from "jomini";

const jomini = await Jomini.initialize();

const updateMeshFile = (content) => {
  const parsed = jomini.parseText(content);

  const pdxMeshList = Array.isArray(parsed.pdxmesh) ? parsed.pdxmesh : [parsed.pdxmesh];

  const result = jomini.write((writer) => {
    for (const pdxmesh of pdxMeshList) {
      console.log(pdxmesh)

      if (pdxmesh.lod_percentages) {
        pdxmesh.lod_percentages = [
          {
            index: 0,
            percent: 0.0,
          },
        ];
      }

      writer.write_unquoted("pdxmesh");
      writer.write_object_start();

      writer.write_unquoted("name");
      writer.write_quoted(pdxmesh.name);
      writer.write_unquoted("file");
      writer.write_quoted(pdxmesh.file);

      writer.write_unquoted("lod_percentages");
      writer.write_object_start();



      // for (const lod_p of pdxmesh.lod_percentages) {
      writer.write_unquoted("lod");
      writer.write_object_start();
      writer.write_unquoted("index");
      writer.write_integer(0);
      writer.write_unquoted("percent");
      writer.write_f32(0.0);
      writer.write_end();
      // }

      writer.write_end();

      const meshSettings = Array.isArray(pdxmesh.meshsettings)
        ? pdxmesh.meshsettings
        : [pdxmesh.meshsettings]

      for (const setting of meshSettings) {
        writer.write_unquoted("meshsettings");
        writer.write_object_start();

        writer.write_unquoted("name");
        writer.write_quoted(setting.name);
        writer.write_unquoted("index");
        writer.write_integer(setting.index);
        writer.write_unquoted("texture_diffuse");
        writer.write_quoted(setting.texture_diffuse);
        writer.write_unquoted("texture_normal");
        writer.write_quoted(setting.texture_normal);

        if (setting.texture) {
          writer.write_unquoted("texture");
          writer.write_object_start();
          writer.write_unquoted("index");
          writer.write_integer(setting.texture.index);
          writer.write_unquoted("srgb");
          writer.write_bool(false);
          writer.write_unquoted("file");
          writer.write_quoted(setting.texture.file);
          writer.write_end();
        }

        writer.write_unquoted("shader");
        writer.write_quoted(setting.shader);

        if (writer.shader_file) {
          writer.write_unquoted("shader_file");
          writer.write_quoted(setting.shader_file);
        }

        writer.write_end();
      }

      writer.write_end();
    }
  });

  const decoded = new TextDecoder().decode(result);
  return decoded;
};

const checkAssetFiles = async (path) => {
  const directories = await readdir(path, { withFileTypes: true });
  const folders = directories.filter((dir) => !dir.isFile());

  // probably in the most inner folder we can get. Check if there is asset file
  if (folders.length <= 1) {
    const assetFile = directories.find((dir) => dir.name.endsWith(".asset"));

    // no directories and asset files. we can delete this.
    if (!assetFile) {
      console.log("removing directory", path);
      await rm(path, { recursive: true });
      return;
    }

    // delete other files than .asset
    for (const file of directories.filter((dir) => dir.name !== assetFile.name)) {
      console.log(`deleting ${file.name} because it's not an asset file`, file.path);
      await rm(`${file.path}/${file.name}`, { recursive: true });
    }

    const content = readFileSync(`${path}/${assetFile.name}`, { encoding: "utf-8" });

    if (!content.includes("lod_percentages")) {
      console.log("no lod percentages for", assetFile.path);
      console.log(`deleting ${path}`);

      await rm(path, { recursive: true });
      return;
    }

    const parsed = updateMeshFile(content);
    writeFileSync(`${path}/${assetFile.name}`, parsed);

    return;
  }

  for (const folder of folders) {
    await checkAssetFiles(`${path}/${folder.name}`);
  }
};

checkAssetFiles("./units");
