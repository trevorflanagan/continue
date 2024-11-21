// write me an interface PackageCrawler that contains:
// 1. property `language` to store a given language like "python" or "typescript"
// 2. has a method `getPackageFiles` which takes a list of file names and decides which ones match package/dependency files (e.g. package.json for typescript, requirements.txt for python, etc)
// 3. has a method `parsePackageFile` which returns a list of package name and version from a relevant package file, in a standardized format like semver
// 4. has a method `getDocumentationLink` to check for documentation link for a given package (e.g. GET `https://registry.npmjs.org/<package>` and find docs field for typescript, documentation link in the package metadata for PyPi, etc.)
// Then, write typescript classes to implement this typescript interface for the languages "python" and "typescript"

import { IDE } from "../../..";
import { walkDir } from "../../walkDir";
import { PythonPackageCrawler } from "./packageCrawlers/Python";
import { TypeScriptPackageCrawler } from "./packageCrawlers/TsJs";

const PACKAGE_CRAWLERS = [TypeScriptPackageCrawler, PythonPackageCrawler];

export interface PackageCrawler {
  language: string;
  getPackageFiles(fileNames: string[]): string[];
  parsePackageFile(fileContent: string, filePath: string): PackageInfo[];
  getDocumentationLink(packageName: string): Promise<PackageDocsResult>;
}

export type PackageInfo = {
  name: string;
  version: string;
  foundInFilepath: string;
};
export type PackageDocsResult = PackageInfo &
  ({ error: string; link?: never } | { link: string; error?: never });

export async function getAllSuggestedDocs(ide: IDE) {
  const workspaceDirs = await ide.getWorkspaceDirs();
  const results = await Promise.all(
    workspaceDirs.map((dir) => {
      return walkDir(dir, ide);
    }),
  );
  const allPaths = results.flat(); // TODO only get files, not dirs. Not critical for now
  const allFiles = allPaths.map((path) => path.split("/").pop()!);
  const packageFilesByLanguage: Record<string, string[]> = {};
  for (const Crawler of PACKAGE_CRAWLERS) {
    const crawler = new Crawler();
    const packageFilePaths = crawler.getPackageFiles(allFiles);
    packageFilesByLanguage[crawler.language] = packageFilePaths;
  }

  const uniqueFilePaths = Array.from(
    new Set(Object.values(packageFilesByLanguage).flat()),
  );
  const fileContentsArray = await Promise.all(
    uniqueFilePaths.map(async (path) => {
      const contents = await ide.readFile(path);
      return { path, contents };
    }),
  );
  const fileContents = new Map(
    fileContentsArray.map(({ path, contents }) => [path, contents]),
  );

  const packagesByLanguage: Record<string, PackageInfo[]> = {};
  PACKAGE_CRAWLERS.forEach((Crawler) => {
    const crawler = new Crawler();
    const packageFiles = packageFilesByLanguage[crawler.language];
    packageFiles.forEach((file) => {
      const contents = fileContents.get(file);
      if (!contents) {
        return;
      }
      const packages = crawler.parsePackageFile(contents, file);
      if (!packagesByLanguage[crawler.language]) {
        packagesByLanguage[crawler.language] = [];
      }
      packagesByLanguage[crawler.language].push(...packages);
    });
  });
  console.log(packagesByLanguage);
  //   const allPackages = await Promise.all(
  //     PACKAGE_CRAWLERS.map(async (Crawler) => {
  //         const crawler = new Crawler();
  //         const packageInfos = uniqueFileContents
  //             .filter(({ path }) => languageToFilePaths[crawler.language].includes(path))
  //             .map(({ path, contents }) => crawler.parsePackageFile(contents, path))
  //             .flat();
  //         return packageInfos;
  //     })
  //   );
  //   for (const Crawler of PACKAGE_CRAWLERS) {
  //     const crawler = new Crawler();
  //     const packages = crawler.parsePackageFile()
  //     languageToFilePaths[crawler.language] = packageFilePaths;
  //   }
}

// I want to present the user with a list of dependencies and allow them to select which ones to index (embed) documentation for.
// In order to prevent duplicate file reads, the process will be like this:
// 1. take in a list of filepaths called `filepaths`
// 2. loop an array of PackageCrawler classes to build a map of `language` (string) to `packageFilePaths` (string[])
// 3. Get unique filepaths from `packageFilePaths` and build a map ` of filepath to file contents using an existing `readFile` function, and skipping file reads of already in the map
// Finally,
// Add a `` method to the interface and classes that returns
// Then, assemble the classes in an array, and write a function getAllSuggestedDocs that returns a map of `language` to an ar
