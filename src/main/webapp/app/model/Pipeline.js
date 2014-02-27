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
Ext.define('PhenoDCC.model.Pipeline', {
    extend: 'Ext.data.Model',
    fields: [
    {
        name: 'i', /* id */
        type: 'int'
    },
    {
        name: 'k', /* key */
        type: 'string'
    },
    {
        name: 'n', /* name */
        type: 'string'
    },
    {
        name: 'v', /* is visible */
        type: 'boolean'
    },
    {
        name: 'a', /* is active */
        type: 'boolean'
    },
    {
        name: 'd', /* is deprecates */
        type: 'boolean'        
    },
    {
        name: 'M', /* major version */
        type: 'boolean'        
    },
    {
        name: 'm', /* minor version */
        type: 'boolean'        
    },
    {
        name: 't', /* is internal */
        type: 'boolean'        
    },
    {
        name: 'x', /* has been deleted */
        type: 'boolean'        
    }
    ],
    requires: [
    'PhenoDCC.proxy.AbortableRest'
    ],
    proxy: {
        type: 'arest',
        url: 'rest/pipelines/extjs',
        headers : {
            'Accept': 'application/json'
        },
        reader: {
            type: 'json',
            root: 'pipelines',
            totalProperty: 'total'
        },
        extraParams: {
            u: dcc.roles.uid,
            s: dcc.roles.ssid
        }
    }
});
