/*
 Licensed to the Apache Software Foundation (ASF) under one
 or more contributor license agreements.  See the NOTICE file
 distributed with this work for additional information
 regarding copyright ownership.  The ASF licenses this file
 to you under the Apache License, Version 2.0 (the
 "License"); you may not use this file except in compliance
 with the License.  You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing,
 software distributed under the License is distributed on an
 "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 KIND, either express or implied.  See the License for the
 specific language governing permissions and limitations
 under the License.
 */

#import <CoreMotion/CoreMotion.h>
#import "CDVDevicemotion.h"

@interface CDVDevicemotion () {}
@property (readwrite, assign) BOOL isRunning;
@property (readwrite, assign) BOOL haveReturnedResult;
@property (readwrite, strong) CMMotionManager* motionManager;
@property (readwrite, assign) double yaw;
@property (readwrite, assign) double pitch;
@property (readwrite, assign) double roll;
@property (readwrite, assign) double alpha;
@property (readwrite, assign) double beta;
@property (readwrite, assign) double gamma;
@property (readwrite, assign) NSTimeInterval timestamp;
@end

@implementation CDVDevicemotion

@synthesize callbackId, isRunning,yaw,pitch,roll,alpha,beta,gamma,timestamp;

// defaults to 10 msec
#define kDeviceMotionInterval 10
// g constant: -9.81 m/s^2
#define kGravitationalConstant -9.81

- (CDVDevicemotion*)init
{
    self = [super init];
    if (self) {
        self.yaw = 0;
        self.pitch = 0;
        self.roll = 0;
        self.alpha = 0;
        self.beta = 0;
        self.gamma = 0;
        self.timestamp = 0;
        self.callbackId = nil;
        self.isRunning = NO;
        self.haveReturnedResult = YES;
        self.motionManager = nil;
    }
    return self;
}

- (void)dealloc
{
    [self stop:nil];
}

- (void)start:(CDVInvokedUrlCommand*)command
{
    self.haveReturnedResult = NO;
    self.callbackId = command.callbackId;

    if (!self.motionManager)
    {
        self.motionManager = [[CMMotionManager alloc] init];
    }

    if ([self.motionManager isDeviceMotionAvailable] == YES) {
        // Assign the update interval to the motion manager and start updates
        [self.motionManager setDeviceMotionUpdateInterval:kDeviceMotionInterval/1000];  // expected in seconds
        __weak CDVDevicemotion* weakSelf = self;
        [self.motionManager startDeviceMotionUpdatesToQueue:[NSOperationQueue mainQueue] withHandler:^(CMDeviceMotion *DeviceMotionData, NSError *error) {
            weakSelf.yaw = DeviceMotionData.attitude.yaw;
            weakSelf.pitch = DeviceMotionData.attitude.pitch;
            weakSelf.roll = DeviceMotionData.attitude.roll;
            weakSelf.alpha = DeviceMotionData.rotationRate.z;
            weakSelf.beta = DeviceMotionData.rotationRate.x;
            weakSelf.gamma = DeviceMotionData.rotationRate.y;
            weakSelf.timestamp = ([[NSDate date] timeIntervalSince1970] * 1000);
            [weakSelf returnMotionlInfo];
        }];

        if (!self.isRunning) {
            self.isRunning = YES;
        }
    }
    else {

        NSLog(@"Running in Simulator? All gyro tests will fail.");
        CDVPluginResult* result = [CDVPluginResult resultWithStatus:CDVCommandStatus_INVALID_ACTION messageAsString:@"Error. DeviceMotion Not Available."];
        
        [self.commandDelegate sendPluginResult:result callbackId:self.callbackId];
    }
    
}

- (void)onReset
{
    [self stop:nil];
}

- (void)stop:(CDVInvokedUrlCommand*)command
{
    if ([self.motionManager isDeviceMotionAvailable] == YES) {
        if (self.haveReturnedResult == NO){
            // block has not fired before stop was called, return whatever result we currently have
            [self returnMotionlInfo];
        }
        [self.motionManager stopDeviceMotionUpdates];
    }
    self.isRunning = NO;
}

- (void)returnMotionlInfo
{
    // Create an acceleration object
    NSMutableDictionary* motionProps = [NSMutableDictionary dictionaryWithCapacity:4];

    [motionProps setValue:[NSNumber numberWithDouble:self.yaw] forKey:@"yaw"];
    [motionProps setValue:[NSNumber numberWithDouble:self.pitch] forKey:@"pitch"];
    [motionProps setValue:[NSNumber numberWithDouble:self.roll] forKey:@"roll"];
    [motionProps setValue:[NSNumber numberWithDouble:self.alpha] forKey:@"alpha"];
    [motionProps setValue:[NSNumber numberWithDouble:self.beta] forKey:@"beta"];
    [motionProps setValue:[NSNumber numberWithDouble:self.gamma] forKey:@"gamma"];
    [motionProps setValue:[NSNumber numberWithDouble:self.timestamp] forKey:@"timestamp"];

    CDVPluginResult* result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsDictionary:motionProps];
    [result setKeepCallback:[NSNumber numberWithBool:YES]];
    [self.commandDelegate sendPluginResult:result callbackId:self.callbackId];
    self.haveReturnedResult = YES;
}
@end