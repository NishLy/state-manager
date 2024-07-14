type HTMLParserConfig = {
  separator: string;
};

class HTMLParser {
  constructor(
    public config: HTMLParserConfig = {
      separator: "{}",
    }
  ) {
    if (config.separator.length !== 2) {
      throw new Error("Separator must be 2 characters long");
    }
  }

  StringfyArray(arr: (Function | string)[], additional?: any) {
    return arr.reduce((acc, curr) => {
      return acc + (typeof curr === "function" ? curr(additional) : curr) + " ";
    }, "");
  }

  ParseStringToFunction(
    html: string,
    parameterName: string
  ): (Function | string)[] {
    const { separator } = this.config;

    function extract(str: string) {
      const matches: {
        start: number;
        end: number | null;
        type: "curly" | "literal";
      }[] = [];
      for (let index = 0; index < str.length; index++) {
        if (str[index] === separator[0]) {
          matches.push({ start: index, end: null, type: "curly" });
          continue;
        }

        if (str[index] === separator[1]) {
          for (let index2 = matches.length - 1; index2 >= 0; index2--) {
            if (
              matches[index2].end === null &&
              matches[index2].type === "curly"
            ) {
              matches[index2].end = index;
              break;
            }
          }
        }
      }

      return matches;
    }

    const matches = extract(html);
    let newString = html;

    matches.forEach((match) => {
      const value = html.slice(match.start + 1, match.end!);

      newString = newString.replace(
        html.slice(match.start, match.end! + 1),
        `%${value.replace(/ /g, "%S")}%`
      );
    });

    const regExp = new RegExp(`%.+%`, "g");
    return newString.split(" ").map((str) => {
      str = str.replace(/%S/g, " ");
      if (str.match(regExp)) {
        return new Function(parameterName, `return ${str.replace(/%/g, "")}`);
      }

      return str.replace(/%/g, "");
    });
  }
}

export default HTMLParser;
