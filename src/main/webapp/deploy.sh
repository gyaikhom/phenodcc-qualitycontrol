#!/bin/bash

# Copyright 2012 Medical Research Council Harwell.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# @author Gagarine Yaikhom <g.yaikhom@har.mrc.ac.uk>

# The following commands deploy a web application for production systems
# To run the commands, first download Sencha SDK Tools from
# http://www.sencha.com/products/sdk-tools/


rm -f all-classes.js app-all.js;

# Some of the dependencies are not capture. So, We have added the
# required dependencies manually into the JSB3 file. Do not run the following
# unless there are significant alterations to the app/ directory.
#
#sencha create jsb -a dev.html -p app.jsb3;
#
# If the following runs successfully, we should have Javascript file
# app-all.js. This file contains all of the required classes compressed
# for deployment. 
sencha build -p app.jsb3 -d .;

# Prepare the visualisation component
java -jar viz/yuicompressor-2.4.7.jar -o viz/viz.DCC_QC_VERSION.js viz/viz.js;

# Now combine all of the Javascripts into one application.
cat viz/d3.v3.min.js viz/viz.DCC_QC_VERSION.js ext-all.js app-all.js > app.DCC_QC_VERSION.js;
rm -Rf app.js viz/d3.v3.min.js viz/viz.DCC_QC_VERSION.js ext-all.js app-all.js;

# Now prepare the style sheets, and combine them. The phenodcc.css is generates from SASS.
java -jar viz/yuicompressor-2.4.7.jar -o resources/css/viz.DCC_QC_VERSION.css resources/css/viz.css;
cat resources/css/phenodcc.css resources/css/viz.DCC_QC_VERSION.css > resources/css/phenodcc.DCC_QC_VERSION.css
rm -Rf resources/css/phenodcc.css resources/css/viz.DCC_QC_VERSION.css;

# Generate the documentation
cd doc;
./prepare.sh;
cd -;
cp doc/manual.html .;
rm -Rf doc;
