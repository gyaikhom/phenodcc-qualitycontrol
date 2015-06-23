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
package org.mousephenotype.dcc.qualitycontrol.persistence;

import javax.persistence.EntityManagerFactory;
import javax.persistence.Persistence;

/**
 *
 * @author Gagarine Yaikhom <g.yaikhom@har.mrc.ac.uk>
 */
public class PersistenceManager {

    protected EntityManagerFactory emf;
    protected EntityManagerFactory drupalEmf;

    private static final String persistenceUnit = "org.mousephenotype.dcc.qualitycontrol.entities.qc.pu";
    private static final String drupalPersistenceUnit = "org.mousephenotype.dcc.qualitycontrol.entities.drupal.pu";
    public PersistenceManager() {
    }

    public EntityManagerFactory getEntityManagerFactory() {
        if (emf == null) {
            createEntityManagerFactory();
        }
        return emf;
    }

    public EntityManagerFactory getDrupalEntityManagerFactory() {
        if (drupalEmf == null) {
            createDrupalEntityManagerFactory();
        }
        return drupalEmf;
    }

    public void closeEntityManagerFactory() {
        if (emf != null) {
            emf.close();
            emf = null;
            System.out.println("Persistence unit '"
                    + persistenceUnit
                    + "' was closed at " + new java.util.Date());
        }
    }

    public void closeDrupalEntityManagerFactory() {
        if (drupalEmf != null) {
            drupalEmf.close();
            drupalEmf = null;
            System.out.println("Drupal persistence unit '"
                    + drupalPersistenceUnit
                    + "' was closed at " + new java.util.Date());
        }
    }

    protected void createEntityManagerFactory() {
        emf = Persistence.createEntityManagerFactory(persistenceUnit);
        System.out.println("Persistence unit '"
                + persistenceUnit
                + "' was created at " + new java.util.Date());
    }

    protected void createDrupalEntityManagerFactory() {
        drupalEmf = Persistence.createEntityManagerFactory(drupalPersistenceUnit);
        System.out.println("Drupal persistence unit '"
                + drupalPersistenceUnit
                + "' was created at " + new java.util.Date());
}
}
