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

import javax.ejb.Stateless;
import javax.persistence.EntityManager;
import javax.persistence.TypedQuery;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.MediaType;
import org.mousephenotype.dcc.entities.impress.Pipeline;
import org.mousephenotype.dcc.entities.overviews.ACentre;
import org.mousephenotype.dcc.qualitycontrol.webservice.pack.PipelinePack;

/**
 *
 * @author Gagarine Yaikhom <g.yaikhom@har.mrc.ac.uk>
 */
@Stateless
@Path("pipelines")
public class PipelineFacadeREST extends AbstractFacade<Pipeline> {

    public PipelineFacadeREST() {
        super(Pipeline.class);
    }

    @GET
    @Path("extjs")
    @Produces(MediaType.APPLICATION_JSON)
    public PipelinePack extjsFindAll(
            @QueryParam("cid") Integer centreId,
            @QueryParam("s") String sessionId,
            @QueryParam("u") Integer userId) {
        PipelinePack p = new PipelinePack();
        if (isValidSession(sessionId, userId)) {
            EntityManager em = getEntityManager();
            ACentre centre = em.find(ACentre.class, centreId);
            if (centre != null) {
                TypedQuery<Pipeline> q = em.createNamedQuery(
                        "Pipeline.findByCentre", Pipeline.class);
                q.setParameter("centreName", centre.getShortName());
                p.setDataSet(q.getResultList());
            }
            em.close();
        } else {
            p.sessionHasExpired();
        }
        return p;
    }
}
