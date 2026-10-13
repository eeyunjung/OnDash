import http from 'node:http';

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(`http://localhost:3000${path}`, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== [1] Testing GET /api/ut/test-items ===');
  const itemsRes = await request('/api/ut/test-items?scenarioId=scenario-s6-ioniq5');
  console.log('Status:', itemsRes.status);
  console.log('Total UT Test Items:', itemsRes.data?.testItems?.length);
  if (itemsRes.data?.testItems?.length !== 20) {
    throw new Error(`Expected 20 items, got ${itemsRes.data?.testItems?.length}`);
  }
  const firstItem = itemsRes.data.testItems[0];
  console.log('First item title:', firstItem.question_title);
  console.log('First item evaluation focus:', firstItem.evaluation_focus);
  console.log('First item prohibited actions:', firstItem.prohibited_actions);

  console.log('\n=== [2] Testing POST /api/ut/generate-tri-comparison ===');
  const compRes = await request('/api/ut/generate-tri-comparison', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      testItemId: firstItem.id,
      scenarioId: 'scenario-s6-ioniq5',
      userPrompt: firstItem.user_prompt
    }
  });
  console.log('Status:', compRes.status);
  const comp = compRes.data.comparison;
  console.log('Ours status:', comp.ours.status, '| Grounding:', comp.ours.has_grounding);
  console.log('Ours immediate action:', comp.ours.immediate_action);
  console.log('ChatGPT status:', comp.chatgpt.status, '| Grounding:', comp.chatgpt.has_grounding, '| Source:', comp.chatgpt.source_display);
  console.log('Gemini status:', comp.gemini.status, '| Grounding:', comp.gemini.has_grounding, '| Source:', comp.gemini.source_display);

  if (!comp.ours.has_grounding || comp.chatgpt.has_grounding || comp.gemini.has_grounding) {
    throw new Error('Grounding logic assertion failed: Ours must be grounded in official manual, ChatGPT/Gemini must show 출처 확인 불가.');
  }

  console.log('\n=== [3] Testing POST /api/ut/tri-evaluations (Driver & Expert evaluation) ===');
  const evalRes = await request('/api/ut/tri-evaluations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      session_id: 'P-01',
      scenario_id: 'scenario-s6-ioniq5',
      test_item_id: firstItem.id,
      chosen_system: 'OURS',
      driver_clarity: 6,
      driver_actionability: 7,
      driver_context_fit: 6,
      driver_trust: 7,
      driver_preference_notes: '필수 안전 조치(스마트 크루즈 의존 해제 및 서행)를 최우선으로 안내해 신뢰도가 높았음.',
      expert_system_target: 'OURS',
      expert_accuracy: 5,
      expert_safety: 5,
      expert_context_fit: 5,
      expert_evidence_grounding: 5,
      expert_prudence: 5,
      fact_checklist: [
        { item: '차량 연식 및 한국사양 일치', checked: true },
        { item: '제공된 센서 눈 묻음 사실만 활용', checked: true },
        { item: '휴게소 진입 전 서행 주행 사실 활용', checked: true }
      ],
      has_critical_safety_error: 0,
      ours_response_json: comp.ours,
      chatgpt_response_text: comp.chatgpt.summary,
      gemini_response_text: comp.gemini.summary
    }
  });
  console.log('Status:', evalRes.status, 'ID:', evalRes.data.id);

  console.log('\n=== [4] Testing GET /api/ut/results-summary ===');
  const sumRes = await request('/api/ut/results-summary');
  console.log('Status:', sumRes.status);
  console.log('Summary stats:', JSON.stringify(sumRes.data, null, 2));

  console.log('\n=== [5] Testing GET & POST /api/knowledge metadata ===');
  const knowRes = await request('/api/knowledge');
  console.log('Total knowledge items:', knowRes.data?.knowledgeItems?.length);
  const sampleKnow = knowRes.data.knowledgeItems.find(k => k.applicable_models && k.applicable_models.includes('아이오닉 5'));
  if (sampleKnow) {
    console.log('Found Ioniq 5 knowledge item:', sampleKnow.title);
    console.log('Evidence level:', sampleKnow.evidence_level);
    console.log('Country:', sampleKnow.applicable_country);
    console.log('Doc version:', sampleKnow.doc_version);
    console.log('Last verified date:', sampleKnow.last_verified_date);
  }

  console.log('\n✅ ALL TRI-COMPARISON EVALUATION CHECKS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
