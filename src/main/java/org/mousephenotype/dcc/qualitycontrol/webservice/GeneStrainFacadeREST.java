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
import javax.ws.rs.*;
import javax.ws.rs.core.MediaType;
import org.mousephenotype.dcc.qualitycontrol.entities.GeneStrain;
import org.mousephenotype.dcc.qualitycontrol.webservice.pack.GeneStrainPack;

/**
 *
 * @author Gagarine Yaikhom <g.yaikhom@har.mrc.ac.uk>
 */
@Stateless
@Path("genestrains")
public class GeneStrainFacadeREST extends AbstractFacade<GeneStrain> {

    public GeneStrainFacadeREST() {
        super(GeneStrain.class);
    }

    @GET
    @Path("extjs")
    @Produces(MediaType.APPLICATION_JSON)
    public GeneStrainPack extjsFindByCentre(
            @QueryParam("cid") Integer centreId,
            @QueryParam("lid") Integer pipelineId,
            @QueryParam("s") String sessionId,
            @QueryParam("u") Integer userId) {
        GeneStrainPack g = new GeneStrainPack();
        if (isValidSession(sessionId, userId)) {
            if (centreId != null && pipelineId != null) {
                EntityManager em = getEntityManager();
                TypedQuery<GeneStrain> query =
                        em.createNamedQuery(
                        "GeneStrain.findByCentrePipeline",
                        GeneStrain.class);
                query.setParameter("cid", centreId);
                query.setParameter("lid", pipelineId);
                g.setDataSet(query.getResultList());
                em.close();
            }
        } else {
            g.setSuccess(false);
        }
        return g;
    }
}
