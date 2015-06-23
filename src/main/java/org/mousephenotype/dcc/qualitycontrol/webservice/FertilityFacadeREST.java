/*
 * Copyright 2013 Medical Research Council Harwell.
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

import org.mousephenotype.dcc.qualitycontrol.webservice.pack.FertilityPack;
import java.util.ArrayList;
import java.util.List;
import javax.ejb.Stateless;
import javax.persistence.EntityManager;
import javax.persistence.TypedQuery;
import javax.ws.rs.*;
import javax.ws.rs.core.MediaType;
import org.mousephenotype.dcc.qualitycontrol.entities.FertilityData;
import org.mousephenotype.dcc.qualitycontrol.entities.KeyValueRecord;

/**
 * Web service for retrieving fertility for a given genotype and parameter.
 *
 * @author Gagarine Yaikhom <g.yaikhom@har.mrc.ac.uk>
 */
@Stateless
@Path("fertility")
public class FertilityFacadeREST extends AbstractFacade<FertilityData> {

    public FertilityFacadeREST() {
        super(FertilityData.class);
    }

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public FertilityPack extjsFindBy(
            @QueryParam("cid") Integer centreId,
            @QueryParam("lid") Integer pipelineId,
            @QueryParam("gid") Integer genotypeId,
            @QueryParam("sid") Integer strainId,
            @QueryParam("peid") String procedureKey,
            @QueryParam("s") String sessionId,
            @QueryParam("u") Integer userId
    ) {
        FertilityPack p = new FertilityPack();
        if (isValidSession(sessionId, userId)) {
            if (centreId == null || pipelineId == null
                    || genotypeId == null || strainId == null
                    || procedureKey == null || procedureKey.isEmpty()) {
                p.setDataSet(null, 0L);
            } else {
                EntityManager em = getEntityManager();
                TypedQuery<KeyValueRecord> q = em.createQuery(
                        "SELECT DISTINCT new org.mousephenotype.dcc.qualitycontrol.entities.KeyValueRecord(q.parameterId, sp.value) FROM Centreprocedure as cp left join ACentre as ct on (ct.shortName = cp.centreid) left join Line as l on (l.lineCentreprocedureHjid = cp) left join Genotype as g on (g.genotype = l.colonyid) left join ProcedureFromRaw as p on (p = l.procedureLineHjid) left join Simpleparameter as sp on (sp.simpleparameterProcedureH0 = p) left join Context as c on (c.subject = p.hjid) left join Parameter as q on (q.parameterKey = sp.parameterid) left join Pipeline as pl on (pl.pipelineKey = cp.pipeline) WHERE ct.centreId = :centreId AND pl.pipelineId = :pipelineId AND g.genotypeId = :genotypeId AND g.strainId = :strainId AND p.procedureid = :procedureKey AND sp.parameterid like :procedureFrag AND c.isValid = 1 AND c.isActive = 1", KeyValueRecord.class);
                q.setParameter("centreId", centreId);
                q.setParameter("pipelineId", pipelineId);
                q.setParameter("genotypeId", genotypeId);
                q.setParameter("strainId", strainId);
                q.setParameter("procedureKey", procedureKey);
                q.setParameter("procedureFrag", "%_FER_%");
                List<KeyValueRecord> r = q.getResultList();
                List<FertilityData> f;
                f = new ArrayList<>();
                f.add(new FertilityData(r));
                p.setDataSet(f);
                em.close();
            }
        } else {
            p.sessionHasExpired();
        }
        return p;
    }
}
