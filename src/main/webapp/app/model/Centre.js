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
Ext.define('PhenoDCC.model.Centre', {
    extend: 'Ext.data.Model',
    fields: [
    {
        name: 'i',
        type: 'int'
    },
    {
        name: 's',
        type: 'string'
    },
    {
        name: 'f',
        type: 'string'
    },
    {
        name: 'c',
        type: 'string'
    },
    {
        name: 'a',
        type: 'string'
    },
    {
        name: 't',
        type: 'string'
    },
    {
        name: 'u',
        type: 'string'
    }
    ],
    associations: [
    /* A centre can have many users.
     * Every user belongs to one and only one centre.
     */
    {
        type: 'hasMany',
        model: 'User',
        primaryKey: 'id', /* primary key in the User model */
        foreignKey: 'centreId' /* associated foreign key in the User model */
    },

    /* A centre can have many data contexts.
     * Every data context belongs to one and only one centre.
     */
    {
        type: 'hasMany',
        model: 'DataContext',
        primaryKey: 'id', /* primary key in the DataContext model */
        foreignKey: 'cid' /* associated foreign key in the DataContext model */
    }
    ],
    requires: [
    'PhenoDCC.proxy.AbortableRest'
    ],
    proxy: {
        type: 'arest',
        url: 'rest/centres/extjs',
        headers : {
            'Accept': 'application/json'
        },
        reader: {
            type: 'json',
            root: 'centres',
            totalProperty: 'total'
        },
        extraParams: {
            u: dcc.roles.uid,
            s: dcc.roles.ssid
        }
    }
});
