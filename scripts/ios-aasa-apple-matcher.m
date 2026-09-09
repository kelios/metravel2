#import <Foundation/Foundation.h>

@interface _SWCPatternMatchingResult : NSObject
@property(nonatomic, readonly) NSUInteger index;
@property(nonatomic, readonly, getter=isExcluded) BOOL excluded;
@end

@interface _SWCPatternMatchingEngine : NSObject
- (instancetype)initWithPatternDictionaries:(NSArray<NSDictionary *> *)patterns;
- (_SWCPatternMatchingResult *)evaluateURLComponents:(NSURLComponents *)components;
@end

static int fail(NSString *category) {
  fprintf(stderr, "%s\n", category.UTF8String);
  return 70;
}

int main(void) {
  @autoreleasepool {
    @try {
      NSData *input = [[NSFileHandle fileHandleWithStandardInput] readDataToEndOfFile];
      NSError *error = nil;
      NSObject *parsed = [NSJSONSerialization
          JSONObjectWithData:input
          options:(NSJSONReadingOptions)0
          error:&error];
      if (error || ![parsed isKindOfClass:[NSDictionary class]]) return fail(@"invalid_input");

      NSDictionary *request = (NSDictionary *)parsed;
      NSArray *patterns = request[@"components"];
      NSArray *urls = request[@"urls"];
      if (![patterns isKindOfClass:[NSArray class]] || ![urls isKindOfClass:[NSArray class]]) {
        return fail(@"invalid_input");
      }

      _SWCPatternMatchingEngine *engine =
          [[_SWCPatternMatchingEngine alloc] initWithPatternDictionaries:patterns];
      if (!engine) return fail(@"matcher_unavailable");

      NSMutableArray<NSDictionary *> *results = [NSMutableArray arrayWithCapacity:urls.count];
      for (NSObject *value in urls) {
        if (![value isKindOfClass:[NSString class]]) return fail(@"invalid_input");
        NSURLComponents *components = [NSURLComponents componentsWithString:(NSString *)value];
        if (!components) return fail(@"invalid_url");
        _SWCPatternMatchingResult *result = [engine evaluateURLComponents:components];
        if (result) {
          [results addObject:@{
            @"matched": @YES,
            @"excluded": @(result.isExcluded),
            @"index": @(result.index),
          }];
        } else {
          [results addObject:@{
            @"matched": @NO,
            @"excluded": @NO,
          }];
        }
      }

      NSData *output = [NSJSONSerialization
          dataWithJSONObject:results
          options:(NSJSONWritingOptions)0
          error:&error];
      if (error || !output) return fail(@"invalid_output");
      [[NSFileHandle fileHandleWithStandardOutput] writeData:output];
      return 0;
    } @catch (__unused NSException *exception) {
      return fail(@"matcher_exception");
    }
  }
}
