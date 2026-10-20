// Standard platform data APIs only. This is not an NS*/background-work waiver:
// unknown selectors, custom source overrides and continuation effects fail closed.
const group = (text, type) => Object.fromEntries(text.split(" ").map(selector => [selector, type]));
const strings = {
  ...group("string stringWithUTF8String: stringWithCString:encoding: stringWithFormat: init initWithUTF8String: initWithCString:encoding: initWithFormat: initWithData:encoding: stringByAppendingString: stringByAppendingPathComponent: stringByReplacingOccurrencesOfString:withString: stringByTrimmingCharactersInSet: substringFromIndex: substringToIndex: description", "NSString"),
  ...group("isEqualToString: isEqual: hasPrefix: hasSuffix: containsString: length intValue integerValue floatValue doubleValue boolValue", "scalar"),
  UTF8String: "c-string", "dataUsingEncoding:": "NSData", "componentsSeparatedByString:": "DataArray",
};
const arrays = {
  ...group("array new init arrayWithArray: mutableCopy copy", "DataArray"),
  ...group("arrayWithObjects: arrayWithObjects:count:", "DataArray"),
  ...group("count containsObject:", "scalar"), ...group("addObject: removeAllObjects removeObjectAtIndex: addObjectsFromArray:", "void"),
  ...group("objectAtIndex: objectAtIndexedSubscript: firstObject lastObject", "DataValue"),
};
const dictionaries = {
  ...group("dictionary new init dictionaryWithObjectsAndKeys: dictionaryWithDictionary: copy mutableCopy", "DataDictionary"),
  ...group("objectForKey: objectForKeyedSubscript:", "DataValue"),
  ...group("setObject:forKey: setObject:forKeyedSubscript: removeObjectForKey: removeAllObjects", "void"), count: "scalar",
};
const methods = {
  NSString: strings, NSMutableString: { ...strings, "appendString:": "void", "appendFormat:": "void", "setString:": "void" },
  DataArray: arrays, NSArray: { count: "scalar", "objectAtIndex:": "unknown", "objectAtIndexedSubscript:": "unknown", firstObject: "unknown", lastObject: "unknown" },
  NSMutableArray: { count: "scalar", "objectAtIndex:": "unknown", "objectAtIndexedSubscript:": "unknown", firstObject: "unknown", lastObject: "unknown" }, DataDictionary: dictionaries,
  NSDictionary: { "objectForKey:": "unknown", "objectForKeyedSubscript:": "unknown", count: "scalar" }, NSMutableDictionary: { "objectForKey:": "unknown", "objectForKeyedSubscript:": "unknown", count: "scalar" },
  NSNumber: { ...group("numberWithInt: numberWithInteger: numberWithLong: numberWithLongLong: numberWithFloat: numberWithDouble: numberWithBool:", "NSNumber"),
    ...group("intValue integerValue longLongValue floatValue doubleValue boolValue", "scalar"), stringValue: "NSString" },
  NSData: { ...group("data dataWithContentsOfFile: dataWithContentsOfURL: initWithBase64EncodedString:options:", "NSData"), length: "scalar", bytes: "c-string", "writeToFile:atomically:": "scalar" },
  NSError: { ...group("errorWithDomain:code:userInfo:", "NSError"), localizedDescription: "NSString", domain: "NSString", code: "scalar", userInfo: "DataDictionary" },
  NSURL: { ...group("URLWithString: fileURLWithPath: URLByAppendingPathComponent: URLByDeletingLastPathComponent", "NSURL"), path: "NSString", absoluteString: "NSString" },
  NSMutableURLRequest: { ...group("requestWithURL: initWithURL:", "NSMutableURLRequest"), "setHTTPMethod:": "void", "setHTTPBody:": "void", "setValue:forHTTPHeaderField:": "void" },
  NSURLSession: { sharedSession: "SharedURLSession" }, DataURLTask: { resume: "void" },
  NSJSONSerialization: { "JSONObjectWithData:options:error:": "DataValue", "dataWithJSONObject:options:error:": "NSData", "isValidJSONObject:": "scalar" },
  NSBundle: { mainBundle: "NSBundle", infoDictionary: "DataDictionary", "objectForInfoDictionaryKey:": "DataValue", "pathForResource:ofType:": "NSString" },
  NSFileManager: { defaultManager: "NSFileManager", "fileExistsAtPath:": "scalar", "fileExistsAtPath:isDirectory:": "scalar", "createDirectoryAtPath:withIntermediateDirectories:attributes:error:": "scalar" },
  NSDate: { date: "NSDate", "dateWithTimeIntervalSinceNow:": "NSDate", timeIntervalSince1970: "scalar" },
  NSCharacterSet: { whitespaceAndNewlineCharacterSet: "NSCharacterSet", whitespaceCharacterSet: "NSCharacterSet" },
  NSUserDefaults: { standardUserDefaults: "NSUserDefaults", "stringForKey:": "NSString", "objectForKey:": "DataValue", "boolForKey:": "scalar", "integerForKey:": "scalar" },
  NSNull: { null: "DataValue" },
  BGProcessingTaskRequest: { "initWithIdentifier:": "BGProcessingTaskRequest", "setEarliestBeginDate:": "void", "setRequiresNetworkConnectivity:": "void", "setRequiresExternalPower:": "void" },
  BGTaskScheduler: { sharedScheduler: "BGTaskScheduler", "cancelTaskRequestWithIdentifier:": "void", "submitTaskRequest:error:": "scalar" },
  UIApplication: { sharedApplication: "ApplicationIdentity" }, ApplicationIdentity: { delegate: "DelegateIdentity" },
};

export const platformSelectors = new Set(Object.values(methods).flatMap(table => Object.keys(table)));

const data = new Set(["NSString", "NSMutableString", "NSData", "NSNumber", "NSError", "NSURL", "NSDate", "NSCharacterSet", "DataArray", "DataDictionary", "DataValue", "scalar", "c-string", "nil", "sqlite3", "sqlite3_stmt", "dispatch_queue_t"]);
export const dataType = type => data.has(type);
export const platformClasses = new Set(Object.keys(methods).filter(name => /^(?:NS|UI|BG)/.test(name)));
export const primitiveFunctions = new Set("NSLog dispatch_async dispatch_get_main_queue dispatch_get_global_queue sqlite3_open sqlite3_close sqlite3_prepare_v2 sqlite3_step sqlite3_exec sqlite3_finalize sqlite3_column_text sqlite3_column_int sqlite3_column_int64 sqlite3_reset NSSearchPathForDirectoriesInDomains NSHomeDirectory NSStringFromClass sizeof".split(" "));
export const platformConstants = new Set("YES NO nil NULL true false NSUTF8StringEncoding NSUnicodeStringEncoding NSASCIIStringEncoding NSDocumentDirectory NSApplicationSupportDirectory NSLibraryDirectory NSUserDomainMask NSJSONReadingMutableContainers NSJSONReadingAllowFragments NSJSONWritingPrettyPrinted SQLITE_OK SQLITE_ROW SQLITE_DONE DISPATCH_QUEUE_PRIORITY_DEFAULT DISPATCH_QUEUE_PRIORITY_BACKGROUND QOS_CLASS_BACKGROUND QOS_CLASS_UTILITY".split(" "));

const classSelectors = new Set("string stringWithUTF8String: stringWithCString:encoding: stringWithFormat: array arrayWithArray: arrayWithObjects: arrayWithObjects:count: dictionary dictionaryWithObjectsAndKeys: dictionaryWithDictionary: numberWithInt: numberWithInteger: numberWithLong: numberWithLongLong: numberWithFloat: numberWithDouble: numberWithBool: data dataWithContentsOfFile: dataWithContentsOfURL: errorWithDomain:code:userInfo: URLWithString: fileURLWithPath: requestWithURL: sharedSession JSONObjectWithData:options:error: dataWithJSONObject:options:error: isValidJSONObject: mainBundle defaultManager date dateWithTimeIntervalSinceNow: whitespaceAndNewlineCharacterSet whitespaceCharacterSet standardUserDefaults null sharedScheduler sharedApplication".split(" "));
export function platformMessage(receiver, selector, args, { shadowed = new Set(), classObject = false } = {}) {
  if (shadowed.has(receiver)) return;
  if (["alloc", "new"].includes(selector) && platformClasses.has(receiver) && classObject && args.length === 0) {
    if (["UIApplication", "NSURLSession", "NSUserDefaults", "NSFileManager", "BGTaskScheduler"].includes(receiver)) return;
    return { type: selector === "new" && ["NSArray", "NSMutableArray"].includes(receiver) ? "DataArray"
      : selector === "new" && ["NSDictionary", "NSMutableDictionary"].includes(receiver) ? "DataDictionary" : receiver };
  }
  if (classObject !== classSelectors.has(selector)) return;
  if (classObject && ["NSArray", "NSMutableArray"].includes(receiver) && ["array", "arrayWithArray:", "arrayWithObjects:"].includes(selector))
    return args.every(dataType) ? { type: "DataArray" } : undefined;
  if (classObject && ["NSDictionary", "NSMutableDictionary"].includes(receiver) && ["dictionary", "dictionaryWithObjectsAndKeys:", "dictionaryWithDictionary:"].includes(selector))
    return args.every(dataType) ? { type: "DataDictionary" } : undefined;
  if (!classObject && ["NSArray", "NSMutableArray", "NSDictionary", "NSMutableDictionary"].includes(receiver) && selector === "init" && args.length === 0)
    return { type: receiver.includes("Array") ? "DataArray" : "DataDictionary" };
  if (receiver === "SharedURLSession" && selector === "dataTaskWithRequest:completionHandler:")
    return args.length === 2 && args[0] === "NSMutableURLRequest" ? { type: "DataURLTask", callbacks: [{ index: 1, params: ["NSData", "NSURLResponse", "NSError"] }] } : undefined;
  const own = (table, key) => table && Object.hasOwn(table, key) ? table[key] : undefined;
  let type = own(own(methods, receiver), selector);
  if (receiver === "DataValue") type = own(strings, selector) || own(dictionaries, selector) || own(arrays, selector);
  if (!type || type === "unknown") return;
  // Callbacks, pointers and request objects are accepted only by their explicit
  // contracts, never as an arbitrary argument to a Foundation data operation.
  const pointerAllowed = selector.endsWith("error:") || selector === "fileExistsAtPath:isDirectory:";
  if (args.some(t => !dataType(t) && !(pointerAllowed && t === "address") && !(selector === "submitTaskRequest:error:" && t === "BGProcessingTaskRequest"))) return;
  return { type };
}

export function platformFunction(name, args, { shadowed = new Set() } = {}) {
  if (shadowed.has(name)) return;
  if (name === "dispatch_async") return args.length === 2 && args[0] === "dispatch_queue_t" ? { type: "void", callbacks: [{ index: 1, params: [] }] } : undefined;
  if (name === "dispatch_get_main_queue" && args.length === 0 || name === "dispatch_get_global_queue" && args.length === 2 && args.every(dataType)) return { type: "dispatch_queue_t" };
  if (name === "NSLog") return args.length > 0 && ["NSString", "c-string"].includes(args[0]) && args.every(dataType) ? { type: "void" } : undefined;
  if (name === "sizeof") return { type: "scalar" };
  if (["NSSearchPathForDirectoriesInDomains"].includes(name)) return args.every(dataType) ? { type: "DataArray" } : undefined;
  if (name === "NSHomeDirectory" && args.length === 0) return { type: "NSString" };
  if (name === "NSStringFromClass") return; // A Class value needs explicit source identity, not a string-cast waiver.
  if (name.startsWith("sqlite3_") && primitiveFunctions.has(name)) {
    const counts = { sqlite3_open: 2, sqlite3_close: 1, sqlite3_prepare_v2: 5, sqlite3_step: 1, sqlite3_exec: 5, sqlite3_finalize: 1, sqlite3_column_text: 2, sqlite3_column_int: 2, sqlite3_column_int64: 2, sqlite3_reset: 1 };
    if (args.length !== counts[name]) return;
    if (name === "sqlite3_open" ? !["c-string", "nil"].includes(args[0]) || args[1] !== "address" : !["sqlite3", "sqlite3_stmt", "nil"].includes(args[0])) return;
    if (name === "sqlite3_exec" && args[2] !== "nil") return;
    if (args.some(t => !dataType(t) && t !== "address")) return;
    return { type: name === "sqlite3_column_text" ? "c-string" : "scalar", outputs: name === "sqlite3_open" ? [[1, "sqlite3"]] : name === "sqlite3_prepare_v2" ? [[3, "sqlite3_stmt"]] : name === "sqlite3_exec" ? [[4, "c-string"]] : [] };
  }
}
