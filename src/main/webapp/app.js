/*
 * Copyright 2012 Medical Research Council Harwell.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 *
 * @author Gagarine Yaikhom <g.yaikhom@har.mrc.ac.uk>
 */

/* The following enables asynchronous download of the ExtJS components. This
 * means faster application loading on the client browser.
 */
//Ext.Loader.setConfig({
//    enabled: true
//});

/* Here, we define a new Javascript namespace named 'PhenoDCC', and all of its
 * components (views, model, stores, and controllers) are stored under the
 * ExJS web application directory 'app'. The Ext.Loader above now knows what to
 * load, and where to load (using the specified namespace to avoid conclict).
 */
//Ext.Loader.setPath('PhenoDCC', 'app');

/* Everything is ready! So, let us build the web application by selecting and
 * joining the components together.
 */
Ext.application({
    name: 'PhenoDCC', /* name of the application (same as namespace) */
    appFolder: 'app',
    autoCreateViewport: true, /* should we build the viewport immediately */

    /* These models correspond to the entities used by the web services. */
    models: [
    'Action',
    'ActionType',
    'Centre',
    'CitedDataPoint',
    'DataContext',
    'GeneStrain',
    'Issue',
    'IssueStatus',
    'AllIssue',
    'Measurement',
    'Parameter',
    'Pipeline',
    'Procedure',
    'ProcedureSpecimen',
    'Specimen',
    'User'
    ],

    /* The following stores use the models defined above. Note that we follow
     * specific naming conventions to make it consisent and predictable:
     *
     * 1. store names are the plural form of the name of the model they use.
     *
     * 2. the 'root' property of the JSON reader inside the proxy for each of
     *     these stores is named using the lowercase form of the store names.
     *
     * 3. these 'root' property names are in fact the URI path component for
     *    accessing the corresponding REST web services.
     *
     * See individual model and store for further detail.
     */
    stores: [
    'Actions',
    'ActionTypes',
    'Centres',
    'CitedDataPoints',
    'DataContexts',
    'GeneStrains',
    'Issues',
    'IssueStatuses',
    'AllIssues',
    'Measurements',
    'Parameters',
    'Pipelines',
    'Procedures',
    'ProcedureSpecimens',
    'Specimens',
    'Users'
    ],

    /* The following are controllers that encapsulate the logic and event
     * management system for all of the views defined in the viewport.
     */
    controllers: ['QualityControl']
});
