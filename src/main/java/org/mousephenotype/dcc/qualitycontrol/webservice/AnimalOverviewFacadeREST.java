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
package org.mousephenotype.dcc.qualitycontrol.webservice;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Iterator;
import java.util.List;
import javax.ejb.Stateless;
import javax.persistence.EntityManager;
import javax.persistence.TypedQuery;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.MediaType;
import org.mousephenotype.dcc.entities.overviews.AnimalOverview;
import org.mousephenotype.dcc.qualitycontrol.webservice.pack.AnimalOverviewPack;

/**
 *
 * @author Gagarine Yaikhom <g.yaikhom@har.mrc.ac.uk>
 */
@Stateless
@Path("specimens")
public class AnimalOverviewFacadeREST extends AbstractFacade<AnimalOverview> {

    public AnimalOverviewFacadeREST() {
        super(AnimalOverview.class);
    }

    @GET
    @Path("extjs/{id}")
    @Produces(MediaType.APPLICATION_JSON)
    public AnimalOverviewPack extjsFind(
            @PathParam("id") Long id,
            @QueryParam("s") String sessionId,
            @QueryParam("u") Integer userId) {
        AnimalOverviewPack p = new AnimalOverviewPack();
        if (isValidSession(sessionId, userId)) {
            ArrayList<AnimalOverview> t = new ArrayList<>();
            t.add(super.find(id));
            p.setDataSet(t);
        } else {
            p.sessionHasExpired();
        }
        return p;
    }

    private List<Long> getAnimalIds(String animalIds) {
        List<Long> a = new ArrayList<>();
        List<String> temp = Arrays.asList(animalIds.split("\\s*,\\s*"));
        Iterator<String> i = temp.iterator();
        while (i.hasNext()) {
            String t = i.next();
            try {
                a.add(Long.parseLong(t));
            } catch (NumberFormatException e) {
            }
        }
        return a;
    }

    @GET
    @Path("extjs/selected")
    @Produces(MediaType.APPLICATION_JSON)
    public AnimalOverviewPack extjsFind(
            @QueryParam("ids") String ids,
            @QueryParam("s") String sessionId,
            @QueryParam("u") Integer userId) {
        AnimalOverviewPack p = new AnimalOverviewPack();
        if (isValidSession(sessionId, userId)) {
            List<Long> a = getAnimalIds(ids);
            if (!a.isEmpty()) {
                EntityManager em = getEntityManager();
                TypedQuery<AnimalOverview> q =
                        em.createNamedQuery("AnimalOverview.findByAnimalIds",
                        AnimalOverview.class);
                q.setParameter("animalIds", a);
                List<AnimalOverview> r = q.getResultList();
                em.close();
                p.setDataSet(r);
            }
        } else {
            p.sessionHasExpired();
        }
        return p;
    }

    @GET
    @Path("extjs")
    @Produces(MediaType.APPLICATION_JSON)
    public AnimalOverviewPack extjsFindAll(
            @QueryParam("s") String sessionId,
            @QueryParam("u") Integer userId) {
        AnimalOverviewPack p = new AnimalOverviewPack();
        if (isValidSession(sessionId, userId)) {
            p.setDataSet(super.findAll());
        } else {
            p.sessionHasExpired();
        }
        return p;
    }
}
